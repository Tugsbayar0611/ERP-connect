/**
 * E-barimt Provider Module
 * Export all providers and interfaces
 */

export * from "./interface";
export { ITCV3Provider } from "./itcv3-provider";

/**
 * Create E-barimt provider instance
 * Factory function to create appropriate provider based on configuration
 */
import type { IEBarimtProvider, EBarimtConfig } from "./interface";
import { ITCV3Provider } from "./itcv3-provider";

export function createEBarimtProvider(config: EBarimtConfig): IEBarimtProvider {
  // For now, only ITCV3Provider (PosAPI 3.0) is available
  // In the future, we can add other providers (e.g., ITCV2Provider, CustomProvider)
  const provider = new ITCV3Provider();
  provider.initialize(config);
  return provider;
}
