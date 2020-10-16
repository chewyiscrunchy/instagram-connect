
import got, { GotRequestFunction, Options, Response } from 'got'
import { createHmac } from 'crypto'

import { Client } from './Client'

import { RequestOptions } from './types/RequestOptions'
import { SignedFormBody } from './types/SignedFormBody'
import { FormData } from './types/FormData'
import { Headers } from './types/Headers'

import * as Constants from './constants'

/**
 * Manages requests and authorization for requests.
 */
export class Request {
    client: Client

    got: GotRequestFunction

    /**
     * @param client Client managing the instance
     */
    constructor (client: Client) {
        this.client = client

        this.got = got.extend({
            prefixUrl: Constants.API_URL,
            cookieJar: this.client.state.cookieJar,
            hooks: { afterResponse: [this.afterResponse.bind(this)] }
        })
    }

    /**
     * Send a request to the API.
     *
     * @param options Request options
     */
    public async send (options: RequestOptions): Promise<unknown> {
        const headers = { ...this.headers, ...(options.headers || {}) }
        const data = { ...this.data, ...(options.data || {}) }
        const form = this.signData(data)

        const requestOptions: Options = {
            url: options.url,
            method: options.method || 'GET',
            responseType: 'json',
            headers,
            form
        }

        const response = await this.got(requestOptions)

        // @ts-expect-error Got doesn't type their responses.
        return response.body
    }

    /**
     * Sign data.
     * 
     * @public
     *
     * @param data Data to sign
     */
    public sign (data: string): string {
        return createHmac('sha256', Constants.SIGNATURE_KEY).update(data).digest('hex')
    }

    /**
     * Sign form data.
     * 
     * @public
     *
     * @param data Form data to sign
     * 
     * @returns {SignedFormBody}
     */
    public signData (data: FormData): SignedFormBody {
        const string = JSON.stringify(data)
        const signature = this.sign(string)

        return {
            ig_sig_key_version: Constants.SIGNATURE_VERSION,
            signed_body: `${signature}.${string}`
        }
    }

    /**
     * After response hook for Got.
     *
     * @param response Got response
     * 
     * @returns {Response}
     */
    private afterResponse (response: Response): Response {
        this.updateStateFromResponse(response)
        return response
    }

    /**
     * Update state from response data
     *
     * @param response Got response
     * 
     * @returns {void}
     */
    private updateStateFromResponse (response: Response): void {
        const {
            'x-ig-set-www-claim': igWWWClaim,
            'ig-set-authorization': authorization,
            'ig-set-password-encryption-key-id': passwordEncryptionKeyId,
            'ig-set-password-encryption-pub-key': passwordEncryptionPublicKey
        } = response.headers

        if (typeof igWWWClaim === 'string') this.client.state.igWWWClaim = igWWWClaim
        if (typeof authorization === 'string') this.client.state.authorization = authorization
        if (typeof passwordEncryptionKeyId === 'string') this.client.state.passwordEncryptionKeyId = passwordEncryptionKeyId
        if (typeof passwordEncryptionPublicKey === 'string') this.client.state.passwordEncryptionPublicKey = passwordEncryptionPublicKey
    }

    /**
     * Default form data for every request.
     * 
     * @private
     * 
     * @returns {FormData}
     */
    private get data (): FormData {
        return {
            _csrfToken: this.client.state.csrfToken
        }
    }

    /**
     * Default headers for every request.
     * 
     * @private
     * 
     * @returns {Headers}
     */
    private get headers (): Headers {
        return {
            'X-Ads-Opt-Out': '1',
            'X-CM-Bandwidth-KBPS': '-1.000',
            'X-CM-Latency': '-1.000',
            'X-IG-Connection-Speed': `3700kbps`,
            'X-IG-Bandwidth-Speed-KBPS': '-1.000',
            'X-IG-Bandwidth-TotalBytes-B': '0',
            'X-IG-Bandwidth-TotalTime-MS': '0',
            'X-IG-EU-DC-ENABLED': 'false',
            'X-IG-Extended-CDN-Thumbnail-Cache-Busting-Value': '1000',
            'X-IG-WWW-Claim': /* this.client.state.igWWWClaim || */ '0',
            'X-Bloks-Is-Layout-RTL': 'false',
            'X-FB-HTTP-Engine': 'Liger',
            'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
            'X-Pigeon-Session-Id': this.client.state.pigeonSessionId,
            'X-IG-Connection-Type': Constants.HEADER_CONNECTION_TYPE,
            'X-IG-Capabilities': Constants.HEADER_CAPABILITIES,
            'X-IG-App-ID': Constants.FACEBOOK_ANALYTICS_APPLICATION_ID,
            'X-Bloks-Version-Id': Constants.BLOKS_VERSION_ID,
            'X-IG-App-Locale': Constants.LANGUAGE,
            'X-IG-Device-Locale': Constants.LANGUAGE,
            'X-IG-Device-ID': this.client.state.uuid,
            'X-IG-Android-ID': this.client.state.deviceId,
            'X-DEVICE-ID': this.client.state.uuid,
            'X-MID': this.client.state.getCookieValue('mid'),
            'Accept-Language': Constants.LANGUAGE.replace('_', '-'),
            'Accept-Encoding': 'gzip',
            'User-Agent': this.client.state.appUserAgent,
            Authorization: this.client.state.authorization,
            Host: Constants.API_HOST,
            Connection: 'close',
        }
    }
}
