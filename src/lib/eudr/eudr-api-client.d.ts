declare module 'eudr-api-client' {
  interface ClientConfig {
    endpoint?: string
    username: string
    password: string
    webServiceClientId: string
    timestampValidity?: number
    timeout?: number
    ssl?: boolean
  }
  interface CallOptions { rawResponse?: boolean; decodeGeojson?: boolean }

  export class EudrEchoClient {
    constructor(config: ClientConfig)
    echo(message: string, options?: CallOptions): Promise<unknown>
  }
  export class EudrSubmissionClient {
    constructor(config: ClientConfig)
    submitDds(request: unknown, options?: CallOptions): Promise<{ ddsIdentifier?: string } & Record<string, unknown>>
    amendDds(ddsIdentifier: string, statement: unknown, options?: CallOptions): Promise<Record<string, unknown>>
    retractDds(ddsIdentifier: string, options?: CallOptions): Promise<Record<string, unknown>>
  }
  export class EudrSubmissionClientV2 extends EudrSubmissionClient {}
  export class EudrRetrievalClient {
    constructor(config: ClientConfig)
    getDdsInfo(uuids: string | string[], options?: CallOptions): Promise<Record<string, unknown>>
    getDdsInfoByInternalReferenceNumber(ref: string, options?: CallOptions): Promise<Record<string, unknown>>
    getStatementByIdentifiers(referenceNumber: string, verificationNumber: string, options?: CallOptions): Promise<Record<string, unknown>>
  }
  export class EudrRetrievalClientV2 extends EudrRetrievalClient {
    getReferencedDds(referenceNumber: string, securityNumber: string, options?: CallOptions): Promise<Record<string, unknown>>
  }
  export class EudrErrorHandler {}
}
