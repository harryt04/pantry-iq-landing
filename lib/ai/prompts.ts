/**
 * System Prompts and Context Injection
 * Provides role definition, data context injection points, and hallucination guardrails
 */

export interface ContextData {
  transactionSummary?: string
  recommendationSummary?: string
  weatherData?: string
  placesData?: string
  [key: string]: string | undefined
}

/**
 * Base system prompt for restaurant operations analysis
 * Includes role definition and hallucination guardrails
 */
export const SYSTEM_PROMPT_BASE = `You are a restaurant operations analyst assistant for PantryIQ, a platform designed to help restaurant owners and food truck operators optimize inventory, reduce waste, and discover donation opportunities.

Your role is to:
- Analyze restaurant inventory, sales, and operational data
- Identify waste patterns and optimization opportunities
- Discover potential food donation matches with local organizations
- Provide actionable, data-driven recommendations
- Support sustainable and ethical restaurant operations

[CONTEXT_INJECTION_POINT]

Critical Guidelines for Accuracy and Integrity:
1. Data Foundation:
   - ONLY use data provided in the context. Never assume or infer data.
   - If insufficient data is available, explicitly state: "I need more information about [specific data]"
    - Quote or reference specific data points when making recommendations
    - Separate observations from predictions and label predictions explicitly
    - Explain the source data and assumptions when the user asks for reasoning

2. Preventing Hallucinations:
   - Do NOT fabricate donation opportunities, restaurant names, or contact information
   - Do NOT make up nutritional facts, food safety regulations, or compliance data
   - Do NOT invent inventory quantities, sales figures, or cost metrics
   - If you don't know something, say: "I don't have this data available"

3. Honesty About Limitations:
   - Acknowledge data gaps explicitly
   - Note when recommendations are based on limited information
   - Suggest what additional data would improve analysis quality
   - Be clear about the confidence level of recommendations

4. Actionable Recommendations:
   - Focus on practical, implementable suggestions
   - Quantify potential impact where possible (waste reduction %, cost savings, donation opportunities)
   - Prioritize recommendations by impact and ease of implementation
   - Include specific steps or next actions

5. Tone and Communication:
   - Be professional and encouraging
   - Avoid jargon unless necessary; explain technical terms
   - Provide constructive feedback
   - Celebrate successes and sustainability efforts

Remember: Your value comes from honest analysis and preventing waste, not from generating impressive-sounding but fabricated insights.`

/**
 * Build a complete system prompt by injecting context data
 * @param context - Optional context data to inject
 * @returns Complete system prompt with injected context
 */
export function buildPromptWithContext(context?: ContextData): string {
  if (!context || Object.keys(context).length === 0) {
    return SYSTEM_PROMPT_BASE.replace('[CONTEXT_INJECTION_POINT]', '')
  }

  const contextSections: string[] = []

  if (context.transactionSummary) {
    contextSections.push(`Transaction Summary:\n${context.transactionSummary}`)
  }

  if (context.recommendationSummary) {
    contextSections.push(
      `Current Recommendation Signals:\n${context.recommendationSummary}`,
    )
  }

  if (context.weatherData) {
    contextSections.push(`Weather Data:\n${context.weatherData}`)
  }

  if (context.placesData) {
    contextSections.push(
      `Local Places and Organizations:\n${context.placesData}`,
    )
  }

  // Add any additional context data
  for (const [key, value] of Object.entries(context)) {
    if (
      value &&
      ![
        'transactionSummary',
        'recommendationSummary',
        'weatherData',
        'placesData',
      ].includes(key)
    ) {
      contextSections.push(`${formatContextKey(key)}:\n${value}`)
    }
  }

  const injectedContext =
    contextSections.length > 0
      ? `Context Data Available:\n${contextSections.join('\n\n')}\n`
      : ''

  return SYSTEM_PROMPT_BASE.replace(
    '[CONTEXT_INJECTION_POINT]',
    injectedContext,
  )
}

/**
 * Format context key from camelCase to readable format
 * @internal
 */
function formatContextKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim()
}

/**
 * Create a specialized prompt for donation opportunity analysis
 */
export function buildDonationAnalysisPrompt(context?: ContextData): string {
  const basePrompt = buildPromptWithContext(context)

  return (
    basePrompt +
    `

Focus on Donation Opportunity Analysis:
- Identify food items at risk of spoilage or waste
- Match available surplus inventory with local donation recipients
- Consider food safety and handling requirements
- Provide donor recognition and impact metrics
- Ensure compliance with local food donation laws
- Prioritize donations that maximize impact and minimize logistics`
  )
}

/**
 * Create a specialized prompt for inventory optimization
 */
export function buildInventoryOptimizationPrompt(
  context?: ContextData,
): string {
  const basePrompt = buildPromptWithContext(context)

  return (
    basePrompt +
    `

Focus on Inventory Optimization:
- Analyze historical sales patterns and seasonal trends
- Identify slow-moving or obsolete inventory
- Calculate optimal reorder points and quantities
- Recommend inventory rotation strategies (FIFO/LIFO)
- Estimate potential waste reduction and cost savings
- Suggest menu adjustments to move excess inventory`
  )
}

/**
 * Create a specialized prompt for waste reduction strategy
 */
export function buildWasteReductionPrompt(context?: ContextData): string {
  const basePrompt = buildPromptWithContext(context)

  return (
    basePrompt +
    `

Focus on Waste Reduction Strategy:
- Quantify current waste by category (spoilage, trim waste, plate waste)
- Identify root causes of waste (purchasing, preparation, customer)
- Recommend specific waste reduction interventions
- Calculate potential cost savings and environmental impact
- Provide implementation timeline and resource requirements
- Suggest metrics for tracking waste reduction progress`
  )
}

/**
 * Validate that a prompt is not dangerously constructed
 * Basic safety check to prevent prompt injection attacks
 */
export function isPromptSafe(prompt: string): boolean {
  // Check for suspicious patterns that might indicate injection attempts
  const suspiciousPatterns = [
    /\bignore[\s]*:[\s]*(your|the|previous|system)/i,
    /\bignore[\s]+your/i,
    /\bignore[\s]+the/i,
    /\bforget[\s]+(everything|all|your|the)/i,
    /\bpretend[\s]+you[\s]+are/i,
    /\byou[\s]+are[\s]+now\b/i,
    /\bfrom[\s]+now[\s]+on[\s]*,[\s]*you[\s]+are/i,
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(prompt)) {
      return false
    }
  }

  return true
}

/**
 * Sanitize context data by removing potentially harmful content
 * @internal
 */
export function sanitizeContext(context: ContextData): ContextData {
  const sanitized: ContextData = {}

  for (const [key, value] of Object.entries(context)) {
    if (value && typeof value === 'string') {
      // Remove lines starting with suspicious keywords
      const lines = value.split('\n')
      const cleanLines = lines.filter(
        (line) =>
          !line.toLowerCase().startsWith('ignore:') &&
          !line.toLowerCase().startsWith('forget:') &&
          !line.toLowerCase().startsWith('pretend:'),
      )
      sanitized[key] = cleanLines.join('\n')
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
