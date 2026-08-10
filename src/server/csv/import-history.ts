export type ImportHistoryItem = {
  id: string
  canonicalName: string
  displayName: string
}

export type ImportItemResolutionAudit = {
  created: ImportHistoryItem[]
  matched: ImportHistoryItem[]
}

export const emptyImportItemResolutionAudit =
  (): ImportItemResolutionAudit => ({
    created: [],
    matched: [],
  })
