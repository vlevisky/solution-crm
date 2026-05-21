export class MessageProvider {
  async sendMessage() {
    throw new Error('Provider not implemented')
  }
}

export class MockMessageProvider extends MessageProvider {
  async sendMessage({ phone, body }) {
    return {
      provider: 'mock',
      status: 'sent',
      externalId: `mock_${Date.now()}`,
      phone,
      body,
    }
  }
}

export class GupshupProvider extends MessageProvider {
  async sendMessage({ phone, body }) {
    return {
      provider: 'gupshup',
      status: 'queued',
      externalId: `gup_${Date.now()}`,
      phone,
      body,
    }
  }
}

export class MetaWhatsAppProvider extends MessageProvider {
  async sendMessage({ phone, body }) {
    return {
      provider: 'meta-whatsapp',
      status: 'queued',
      externalId: `meta_${Date.now()}`,
      phone,
      body,
    }
  }
}

export class IHelpProvider extends MessageProvider {
  async sendMessage({ phone, body }) {
    return {
      provider: 'ihelp',
      status: 'queued',
      externalId: `ihelp_${Date.now()}`,
      phone,
      body,
    }
  }
}

export function createMessageProvider() {
  if (process.env.META_WHATSAPP_TOKEN) return new MetaWhatsAppProvider()
  if (process.env.GUPSHUP_API_KEY) return new GupshupProvider()
  if (process.env.IHELP_API_KEY) return new IHelpProvider()
  return new MockMessageProvider()
}
