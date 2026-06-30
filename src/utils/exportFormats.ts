import type { FormState, SummaryState } from '@/types/form'
import type { ReviewStatus } from '@/config/domain/types'

interface ExportData {
  form: FormState
  summary: SummaryState
  computedSummary: string
  qualityScore: number
  reviewStatus: ReviewStatus
  role: string
  timestamp: string
}

// ─── Markdown Export ─────────────────────────────────────────────────────────

export function exportMarkdown(data: ExportData): string {
  const lines: string[] = []

  lines.push(`# ${data.computedSummary}`)
  lines.push('')
  lines.push(`**Project**: ${data.form.projectKey}`)
  lines.push(`**Issue Type**: ${data.form.issueType}`)
  lines.push(`**Assignee**: ${data.form.assignee || '—'}`)
  lines.push(`**Story Points**: ${data.form.estimatedPoints}`)
  lines.push(`**Quality Score**: ${data.qualityScore}/100`)
  lines.push(`**Review Status**: ${data.reviewStatus}`)
  lines.push(`**Role**: ${data.role}`)
  lines.push(`**Date**: ${data.timestamp}`)
  lines.push('')

  // Traceability
  if (data.form.requirementLevel && data.form.requirementLevel !== 'none') {
    lines.push('## Traceability')
    lines.push(`- **Requirement Level**: ${data.form.requirementLevel}`)
    if (data.form.parentReqId) lines.push(`- **Parent Requirement**: ${data.form.parentReqId}`)
    if (data.form.verificationMethod) lines.push(`- **Verification Method**: ${data.form.verificationMethod}`)
    lines.push('')
  }

  // Summary breakdown
  lines.push('## Summary Structure')
  lines.push(`| Field | Value |`)
  lines.push(`|-------|-------|`)
  lines.push(`| Composite Code | ${data.summary.compositeCode} |`)
  lines.push(`| Layer | ${data.summary.layer} |`)
  lines.push(`| Component | ${data.summary.component} |`)
  lines.push(`| Detail | ${data.summary.detail} |`)
  lines.push('')

  // Description
  lines.push('## Description')
  lines.push('')
  lines.push(data.form.description || '*(empty)*')
  lines.push('')
  lines.push('---')
  lines.push(`*Exported from Agentic Engineering Platform*`)

  return lines.join('\n')
}

// ─── ReqIF Export ────────────────────────────────────────────────────────────

export function exportReqIF(data: ExportData): string {
  const id = `REQ-${Date.now()}`
  const now = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd">
  <THE-HEADER>
    <REQ-IF-HEADER IDENTIFIER="header-${id}">
      <COMMENT>Exported from Agentic Engineering Platform</COMMENT>
      <CREATION-TIME>${now}</CREATION-TIME>
      <TITLE>${escapeXml(data.computedSummary)}</TITLE>
    </REQ-IF-HEADER>
  </THE-HEADER>
  <CORE-CONTENT>
    <REQ-IF-CONTENT>
      <DATATYPES>
        <DATATYPE-DEFINITION-STRING IDENTIFIER="dt-string" LONG-NAME="String" MAX-LENGTH="4096"/>
        <DATATYPE-DEFINITION-INTEGER IDENTIFIER="dt-int" LONG-NAME="Integer" MIN="0" MAX="999"/>
      </DATATYPES>
      <SPEC-TYPES>
        <SPEC-OBJECT-TYPE IDENTIFIER="req-type" LONG-NAME="Requirement">
          <SPEC-ATTRIBUTES>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="attr-summary" LONG-NAME="Summary">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="attr-description" LONG-NAME="Description">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="attr-level" LONG-NAME="RequirementLevel">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="attr-parent" LONG-NAME="ParentRequirement">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="attr-verify" LONG-NAME="VerificationMethod">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-INTEGER IDENTIFIER="attr-quality" LONG-NAME="QualityScore">
              <TYPE><DATATYPE-DEFINITION-INTEGER-REF>dt-int</DATATYPE-DEFINITION-INTEGER-REF></TYPE>
            </ATTRIBUTE-DEFINITION-INTEGER>
          </SPEC-ATTRIBUTES>
        </SPEC-OBJECT-TYPE>
      </SPEC-TYPES>
      <SPEC-OBJECTS>
        <SPEC-OBJECT IDENTIFIER="${id}" LAST-CHANGE="${now}">
          <TYPE><SPEC-OBJECT-TYPE-REF>req-type</SPEC-OBJECT-TYPE-REF></TYPE>
          <VALUES>
            <ATTRIBUTE-VALUE-STRING>
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>attr-summary</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
              <THE-VALUE>${escapeXml(data.computedSummary)}</THE-VALUE>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING>
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>attr-description</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
              <THE-VALUE>${escapeXml(data.form.description)}</THE-VALUE>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING>
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>attr-level</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
              <THE-VALUE>${escapeXml(data.form.requirementLevel || 'none')}</THE-VALUE>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING>
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>attr-parent</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
              <THE-VALUE>${escapeXml(data.form.parentReqId || '')}</THE-VALUE>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING>
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>attr-verify</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
              <THE-VALUE>${escapeXml(data.form.verificationMethod || '')}</THE-VALUE>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-INTEGER>
              <DEFINITION><ATTRIBUTE-DEFINITION-INTEGER-REF>attr-quality</ATTRIBUTE-DEFINITION-INTEGER-REF></DEFINITION>
              <THE-VALUE>${data.qualityScore}</THE-VALUE>
            </ATTRIBUTE-VALUE-INTEGER>
          </VALUES>
        </SPEC-OBJECT>
      </SPEC-OBJECTS>
    </REQ-IF-CONTENT>
  </CORE-CONTENT>
</REQ-IF>`
}

// ─── Excel CSV Export ────────────────────────────────────────────────────────

export function exportExcelCSV(data: ExportData): string {
  const headers = [
    'Summary', 'Project', 'Issue Type', 'Assignee', 'Story Points',
    'Composite Code', 'Layer', 'Component', 'Detail',
    'Description', 'Requirement Level', 'Parent Requirement',
    'Verification Method', 'Quality Score', 'Review Status', 'Role', 'Date'
  ]

  const values = [
    data.computedSummary,
    data.form.projectKey,
    data.form.issueType,
    data.form.assignee || '',
    String(data.form.estimatedPoints),
    data.summary.compositeCode,
    data.summary.layer,
    data.summary.component,
    data.summary.detail,
    data.form.description,
    data.form.requirementLevel || 'none',
    data.form.parentReqId || '',
    data.form.verificationMethod || '',
    String(data.qualityScore),
    data.reviewStatus,
    data.role,
    data.timestamp
  ]

  return headers.map(csvEscape).join(',') + '\n' +
    values.map(csvEscape).join(',') + '\n'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// ─── Download helper ─────────────────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
