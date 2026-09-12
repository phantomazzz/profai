/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Демо-режим для заказчика: отчёт показывается сразу (образец), без вызова LLM. */
  readonly VITE_DEMO?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
