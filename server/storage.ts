export * from "./storage/interface";
import { SystemStorage } from "./storage/system";

export const storage = new SystemStorage();
