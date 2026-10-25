//
//  AppleAccountToken.swift
//  waqtu
//
//  The StoreKit `appAccountToken` that ties an App Store purchase to a Waqtu account. Must match
//  services/api/src/billing/apple.ts `appleAccountToken` and apps/mobile/src/premium/accountToken.ts:
//  SHA-256("waqtu-apple:<userId>"), first 16 bytes, version 5 and RFC 4122 variant bits set.
//

import CryptoKit
import Foundation

enum AppleAccountToken {
    static func uuid(forUserId userId: String) -> UUID {
        var bytes = Array(SHA256.hash(data: Data("waqtu-apple:\(userId)".utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x50
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return UUID(uuid: (
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
        ))
    }
}
