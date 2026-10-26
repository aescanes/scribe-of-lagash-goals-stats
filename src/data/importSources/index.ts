// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { ImportSource } from "./importSource";
import { KeepTheRhythmSource } from "./keepTheRhythm";

/** Every supported source, in the order the settings dropdown lists them. */
export const IMPORT_SOURCES: readonly ImportSource[] = [new KeepTheRhythmSource()];

export function getImportSource(id: string): ImportSource | undefined {
	return IMPORT_SOURCES.find((source) => source.id === id);
}
