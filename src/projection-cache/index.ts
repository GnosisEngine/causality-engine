// src/projection-cache/index.ts

export { createComponentTypeRegistry } from './registry.js'
export type { ComponentType, ComponentTypeRegistry } from './registry.js'

export { createDirtyFlagStore } from './dirty-flags.js'
export type { DirtyFlagStore } from './dirty-flags.js'

export { createProjectionCache } from './deriver.js'
export type { ProjectionCache } from './deriver.js'
