'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  canonicalFieldLabels,
  type CanonicalField,
  type CsvColumnDetection,
  type CsvMappingDetection,
} from '@/src/server/csv/mapping'
import type { CsvPreview } from '@/src/server/csv/parser'

type MappingAnswer = CanonicalField | null
type Answers = Partial<Record<number, MappingAnswer>>

export function getMappingReviewColumns(
  mapping: CsvMappingDetection,
): CsvColumnDetection[] {
  return mapping.columns.filter((column) => column.band !== 'auto')
}

export function mappingReviewProgress(
  columns: CsvColumnDetection[],
  answers: Answers,
): { completed: number; total: number } {
  return {
    completed: columns.filter((column) =>
      Object.hasOwn(answers, column.sourceIndex),
    ).length,
    total: columns.length,
  }
}

function answerFor(column: CsvColumnDetection, answers: Answers) {
  return Object.hasOwn(answers, column.sourceIndex)
    ? answers[column.sourceIndex]
    : column.targetField
}

function columnKey(column: CsvColumnDetection) {
  return `${column.sourceIndex}-${column.sourceColumn}`
}

function displayValue(value: string) {
  return value.trim() || 'Blank value'
}

export function CsvMappingReview({
  mapping,
  preview,
  onMappingAccepted,
}: {
  mapping: CsvMappingDetection
  preview: Pick<CsvPreview, 'previewRows'>
  onMappingAccepted: (mapping: Record<string, CanonicalField | null>) => void
}) {
  const [isEditing, setIsEditing] = React.useState(!mapping.reused)
  const reviewColumns = React.useMemo(() => {
    if (mapping.reused && isEditing) return mapping.columns
    return getMappingReviewColumns(mapping)
  }, [isEditing, mapping])
  const [answers, setAnswers] = React.useState<Answers>({})
  const [currentPosition, setCurrentPosition] = React.useState(0)
  const [isComplete, setIsComplete] = React.useState(false)
  const didAutoAccept = React.useRef(false)

  const progress = mappingReviewProgress(reviewColumns, answers)
  const currentColumn = reviewColumns[currentPosition]

  function valuesFor(column: CsvColumnDetection) {
    return preview.previewRows
      .map((row) => row.values[column.sourceIndex] ?? '')
      .filter((value) => value.trim())
      .slice(0, 5)
  }

  function selectedValue(column: CsvColumnDetection) {
    return answerFor(column, answers) ?? ''
  }

  function choose(column: CsvColumnDetection, value: string) {
    setAnswers((previous) => ({
      ...previous,
      [column.sourceIndex]: value ? (value as CanonicalField) : null,
    }))
  }

  function acceptedMapping(nextAnswers: Answers = answers) {
    return Object.fromEntries(
      mapping.columns.map((column) => [
        column.sourceColumn,
        column.band === 'auto' &&
        !Object.hasOwn(nextAnswers, column.sourceIndex)
          ? column.targetField
          : (nextAnswers[column.sourceIndex] ?? null),
      ]),
    ) as Record<string, CanonicalField | null>
  }

  function next() {
    if (!currentColumn) return
    const selected = selectedValue(currentColumn)
    const answer: MappingAnswer = selected ? (selected as CanonicalField) : null
    const nextAnswers = {
      ...answers,
      [currentColumn.sourceIndex]: answer,
    }
    choose(currentColumn, selected)
    if (currentPosition === reviewColumns.length - 1) {
      setIsComplete(true)
      onMappingAccepted(acceptedMapping(nextAnswers))
      return
    }
    setCurrentPosition((position) => position + 1)
  }

  function previous() {
    setIsComplete(false)
    setCurrentPosition((position) => Math.max(0, position - 1))
  }

  function editColumn(sourceIndex: number) {
    const position = reviewColumns.findIndex(
      (column) => column.sourceIndex === sourceIndex,
    )
    if (position < 0) return
    setCurrentPosition(position)
    setIsComplete(false)
  }

  React.useEffect(() => {
    if (
      !mapping.reused &&
      reviewColumns.length === 0 &&
      !didAutoAccept.current
    ) {
      didAutoAccept.current = true
      onMappingAccepted(acceptedMapping())
    }
  }, [mapping, onMappingAccepted, reviewColumns.length])

  if (mapping.reused && !isEditing) {
    return (
      <section className="csv-mapping" aria-labelledby="csv-mapping-title">
        <div className="csv-mapping__heading">
          <div>
            <p className="app-page__eyebrow">Column mapping</p>
            <h2 id="csv-mapping-title">We reused your last mapping.</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsEditing(true)}
          >
            Change mapping
          </Button>
        </div>
        <p className="app-page__help" role="status">
          The file has the same column shape as an earlier {mapping.importType}{' '}
          import. Nothing needs reviewing unless you want to change it.
        </p>
      </section>
    )
  }

  if (reviewColumns.length === 0) {
    return (
      <section className="csv-mapping" aria-labelledby="csv-mapping-title">
        <p className="app-page__eyebrow">Column mapping</p>
        <h2 id="csv-mapping-title">All columns matched. Ready to import?</h2>
        <p className="app-page__help">
          Every column has a high-confidence match. Columns not in this list
          will stay out of the import.
        </p>
      </section>
    )
  }

  if (isComplete) {
    return (
      <section className="csv-mapping" aria-labelledby="csv-mapping-title">
        <p className="app-page__eyebrow">Column mapping</p>
        <h2 id="csv-mapping-title">Mapping reviewed.</h2>
        <p className="app-page__help" role="status">
          {progress.completed} columns reviewed. Skipped columns stay out of the
          import.
        </p>
        <Table>
          <caption className="sr-only">Reviewed CSV column mappings</caption>
          <TableHeader>
            <TableRow>
              <TableHead>File column</TableHead>
              <TableHead>PantryIQ field</TableHead>
              <TableHead>
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mapping.columns.map((column) => {
              const value = Object.hasOwn(answers, column.sourceIndex)
                ? answers[column.sourceIndex]
                : column.targetField
              return (
                <TableRow key={columnKey(column)}>
                  <TableCell>{column.sourceColumn}</TableCell>
                  <TableCell>
                    {value ? canonicalFieldLabels[value] : 'Skipped'}
                  </TableCell>
                  <TableCell className="text-right">
                    {column.band === 'auto' && !mapping.reused ? (
                      <span className="app-page__help">Matched</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => editColumn(column.sourceIndex)}
                      >
                        Change
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="app-page__help">
          The import confirmation step will appear after item matching is
          available.
        </p>
      </section>
    )
  }

  const values = currentColumn ? valuesFor(currentColumn) : []
  const selected = currentColumn ? selectedValue(currentColumn) : ''

  return (
    <section className="csv-mapping" aria-labelledby="csv-mapping-title">
      <div className="csv-mapping__heading">
        <div>
          <p className="app-page__eyebrow">Column mapping</p>
          <h2 id="csv-mapping-title">
            Let&apos;s place the uncertain columns.
          </h2>
        </div>
        <p
          className="csv-mapping__progress"
          aria-label={`Column ${currentPosition + 1} of ${reviewColumns.length}`}
        >
          Column {currentPosition + 1} of {reviewColumns.length}
        </p>
      </div>
      {currentColumn ? (
        <div className="csv-mapping__question">
          <p className="csv-mapping__source-label">File column</p>
          <h3>{currentColumn.sourceColumn}</h3>
          <p className="app-page__help">
            Choose the PantryIQ field that best describes this column, or skip
            it. Skipping is always okay.
          </p>
          <div
            className="csv-mapping__examples"
            aria-labelledby="example-title"
          >
            <p id="example-title" className="csv-mapping__source-label">
              Example values
            </p>
            {values.length > 0 ? (
              <ul>
                {values.map((value, index) => (
                  <li key={`${currentColumn.sourceIndex}-${index}`}>
                    <code>{displayValue(value)}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="app-page__help">No example values were found.</p>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor="mapping-field">PantryIQ field</FieldLabel>
            <NativeSelect
              id="mapping-field"
              value={selected}
              onChange={(event) => choose(currentColumn, event.target.value)}
            >
              <option value="">Skip this column</option>
              {currentColumn.candidates.map((candidate) => (
                <option key={candidate.field} value={candidate.field}>
                  {canonicalFieldLabels[candidate.field]}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              {currentColumn.evidence.join(' ')}
            </FieldDescription>
          </Field>
          <div className="csv-mapping__actions">
            <Button
              type="button"
              variant="ghost"
              onClick={previous}
              disabled={currentPosition === 0}
            >
              Back
            </Button>
            <Button type="button" onClick={next}>
              {currentPosition === reviewColumns.length - 1
                ? 'Review mapping'
                : 'Next column'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
