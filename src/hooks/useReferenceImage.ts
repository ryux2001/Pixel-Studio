import { useEffect, useRef, useState } from "react";
import { inspectPng, REFERENCE_LIMIT } from "@/lib/io/png";
import type { SessionView } from "@/lib/workspace/storage";

type Reference = NonNullable<SessionView["reference"]>;
export function useReferenceImage(initial: SessionView["reference"] = null, check?: (record: Reference) => void, save?: (record: Reference | null) => Promise<void>) {
  const [record, setRecord] = useState(initial);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [committing,setCommitting]=useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => {
    if (!record) return;
    const next = URL.createObjectURL(record.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [record]);
  const cancel = () => { sequence.current++; setLoading(false); setError(""); };
  const remove = async () => {
    cancel(); const request=sequence.current;setCommitting(true);
    try{await save?.(null);if(request===sequence.current){setRecord(null);setUrl(null);}}
    catch(cause){if(request===sequence.current)setError(cause instanceof Error?cause.message:String(cause));}
    finally{if(request===sequence.current)setCommitting(false);}
  };
  const load = async (file: File) => {
    const request = ++sequence.current; setLoading(true); setError("");
    try {
      if (file.size > REFERENCE_LIMIT) throw new Error("La referencia supera 10 MiB.");
      const bytes = new Uint8Array(await file.arrayBuffer()); const dimensions = inspectPng(bytes, true);
      if (request !== sequence.current) return;
      const next = { blob: file, name: file.name, ...dimensions };
      check?.(next);
      const bitmap = await createImageBitmap(file); bitmap.close();
      if (request !== sequence.current) return;
      setCommitting(true);await save?.(next);
      if (request !== sequence.current) return;
      setRecord(next);
    } catch (cause) { if (request === sequence.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (request === sequence.current) {setLoading(false);setCommitting(false);} }
  };
  return { image: record && url ? { url, name: record.name } : null, record, loading, committing, error, load, remove, cancel };
}
