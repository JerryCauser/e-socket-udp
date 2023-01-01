/// <reference types="node" />
import type { Buffer } from 'node:buffer'
import type { EventEmitter } from 'node:events'
import type * as Basic from 'socket-udp'

export const DEFAULT_PORT: number
export const WARNING_MISSING_MESSAGE: Symbol
export const WARNING_DECRYPTION_FAIL: Symbol

export interface MessageHead extends Basic.MessageHead {
    body?: Buffer
    /** Contains original size of passed message before decryption and/or defragmentation */
    originSize?: number,
    /** Contains id of message. Available only in fragmented mode */
    id?: string,
    /** Contains date settled by client when message was sent. Available only in fragmented mode */
    sentDate?: Date
}

export type UDPSocketOptions = Basic.UDPSocketOptions & {
    /**
     * if passed string - will be applied 'aes-256-ctr' decryption with passed string as secret, so it should be 64char long;
     * if passed function - will be used that function to decrypt every message;
     * if passed undefined - will not use any kind of decryption
     */
    decryption?: (Buffer) => Buffer | string
    /**
     * Enables fragmentation mode. Required for big messages
     */
    fragmentation?: boolean
    /**
     * How often instance will check internal buffer to delete expired messages
     */
    gcIntervalTime?: number
    /**
     * How long chunks can await all missing chunks in internal buffer
     */
    gcExpirationTime?: number
} | undefined

export class UDPSocket extends Basic.UDPSocket {
    constructor (options?: UDPSocketOptions)
    handleMessage (body: Buffer | any, head?: MessageHead | undefined): boolean
}

export type UDPClientOptions = Basic.UDPClientOptions & {
    /**
     * if passed string - will be applied aes-256-ctr encryption with passed string as secret;
     * if passed function - will be used that function to encrypt every message;
     * if passed undefined - will not use any kind of encryption
     */
    encryption?: (Buffer) => Buffer | string
    /**
     * Enables fragmentation.
     * Useful to transfer large messages in parallel without messing them up
     */
    fragmentation?: boolean
    /**
     * In bytes. Used when fragmentation enabled
     */
    packetSize?: number
} | undefined

export class UDPClient extends Basic.UDPClient {
    constructor (options?: UDPClientOptions)
    handleMessage(body: Buffer, head: MessageHead): void
}

declare type CollectorElem = [
  msgBodyMap:Map<number, Buffer>,
  lastUpdate: number,
  msgDate: Date,
  msgId: string,
  originSize: number
]

declare type CollectorMap = Map<string, CollectorElem>


declare type WarningMessage = {
    type: Symbol,
    id: string,
    date: Date
}

export interface CollectorInstance {
    set (id: string, value: CollectorElem): this
    get (id: string): CollectorElem
    delete (id: string): boolean
    start? (): void
    stop? (): void
    on? (event: 'warning', listener: (message: WarningMessage) => void): this
    on? (event: string, listener: Function): this
    off? (event: 'warning', listener: (message: WarningMessage) => void): this
    off? (event: string, listener: Function): this
}

declare class Collector extends EventEmitter implements CollectorInstance {
    set (id: string, value: CollectorElem): this
    get (id: string): CollectorElem
    delete (id: string): boolean
    start (): void
    stop (): void
    on (event: 'warning', listener: (message: WarningMessage) => void): this
    on (event: string, listener: Function): this
    off (event: 'warning', listener: (message: WarningMessage) => void): this
    off (event: string, listener: Function): this
}
