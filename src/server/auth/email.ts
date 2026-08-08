type AuthEmail = {
  to: string
  subject: string
  text: string
}

/**
 * Authentication email delivery is intentionally separate from product
 * notifications. Production uses the configured transactional provider;
 * local development can provide a test sender without weakening auth flows.
 */
export async function sendAuthEmail(message: AuthEmail) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.AUTH_EMAIL_FROM

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Authentication email delivery is not configured.')
    }

    console.info('[auth email omitted in local development]', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    })
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Authentication email delivery failed (${response.status}).`,
    )
  }
}
