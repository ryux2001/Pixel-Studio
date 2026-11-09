import { exportAnimation, type AnimationExportInput } from "./animation-export";
self.onmessage = async (event: MessageEvent<AnimationExportInput>) => {
  try {
    const result = await exportAnimation(event.data,(done,total)=>self.postMessage({type:"progress",done,total}));
    self.postMessage({type:"result",result});
  } catch (error) { self.postMessage({type:"error",error:error instanceof Error?error.message:"No se pudo exportar la animación."}); }
};
