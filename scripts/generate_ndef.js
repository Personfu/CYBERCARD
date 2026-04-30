#!/usr/bin/env node
// scripts/generate_ndef.js - NTAG216 NDEF payload generator
// Furulie LLC / CyberFlipper
//
// Usage:
//   node scripts/generate_ndef.js --url "https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card"
//   node scripts/generate_ndef.js --url "https://fllc.net/tap?card_id=ar_v1"   --card-id ar_v1
//
// Output:
//   - Raw hex bytes ready to write to NTAG216 pages 4+ via:
//       Flipper Zero NFC app (write NDEF)
//       NFC Tools (mobile)
//       Proxmark3: hf mfu ndefwrite -d <hex>
//       This firmware: MODE_NFC_WRITE

const args = process.argv.slice(2)

function getArg(flag, fallback = '') {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : fallback
}

const rawUrl = getArg('--url', 'https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card')
const cardId = getArg('--card-id', 'metal_v1')
const dryRun = args.includes('--dry-run')

// URI prefix table (NFC URI Record type)
const URI_PREFIXES = {
  ''              : 0x00,
  'http://www.'   : 0x01,
  'https://www.'  : 0x02,
  'http://'       : 0x03,
  'https://'      : 0x04,
  'tel:'          : 0x05,
  'mailto:'       : 0x06,
  'ftp://anonymous@': 0x07,
  'ftp://ftp.'    : 0x08,
  'ftps://'       : 0x09,
  'sftp://'       : 0x0A,
  'smb://'        : 0x0B,
  'nfs://'        : 0x0C,
  'ftp://'        : 0x0D,
  'dav://'        : 0x0E,
  'news:'         : 0x0F,
  'telnet://'     : 0x10,
  'imap:'         : 0x11,
  'rtsp://'       : 0x12,
  'urn:'          : 0x13,
  'pop:'          : 0x14,
  'sip:'          : 0x15,
  'sips:'         : 0x16,
  'tftp:'         : 0x17,
  'btspp://'      : 0x18,
  'btl2cap://'    : 0x19,
  'btgoep://'     : 0x1A,
  'tcpobex://'    : 0x1B,
  'irdaobex://'   : 0x1C,
  'file://'       : 0x1D,
  'urn:epc:id:'   : 0x1E,
  'urn:epc:tag:'  : 0x1F,
  'urn:epc:pat:'  : 0x20,
  'urn:epc:raw:'  : 0x21,
  'urn:epc:'      : 0x22,
  'urn:nfc:'      : 0x23,
}

function encodeUri(url) {
  // Find longest matching prefix
  let prefixCode = 0x00
  let remainder  = url

  for (const [prefix, code] of Object.entries(URI_PREFIXES)) {
    if (prefix && url.startsWith(prefix) && prefix.length > (URI_PREFIXES[remainder] ? 0 : 1)) {
      prefixCode = code
      remainder  = url.slice(prefix.length)
      break
    }
  }

  const urlBytes = Buffer.from(remainder, 'utf8')
  const payload  = Buffer.concat([Buffer.from([prefixCode]), urlBytes])

  // NDEF URI record
  // Flags: MB=1 ME=1 SR=1 TNF=0x01 (Well-Known)
  const typeLen    = 1   // 'U'
  const payloadLen = payload.length
  const record = Buffer.alloc(3 + typeLen + payloadLen)
  record[0] = 0xD1                           // MB + ME + SR + TNF=0x01
  record[1] = typeLen
  record[2] = payloadLen
  record[3] = 0x55                           // 'U' = URI record type
  payload.copy(record, 4)

  // TLV wrapper
  const tlv = Buffer.alloc(2 + record.length + 1)
  tlv[0] = 0x03                              // NDEF TLV tag
  tlv[1] = record.length                     // length (assumes < 255)
  record.copy(tlv, 2)
  tlv[tlv.length - 1] = 0xFE               // Terminator TLV

  return tlv
}

function toPages(buf) {
  const pages = []
  for (let i = 0; i < buf.length; i += 4) {
    pages.push(buf.slice(i, i + 4))
  }
  // Pad last page to 4 bytes
  const last = pages[pages.length - 1]
  if (last && last.length < 4) {
    pages[pages.length - 1] = Buffer.concat([last, Buffer.alloc(4 - last.length)])
  }
  return pages
}

// Main
const ndefPayload = encodeUri(rawUrl)
const pages       = toPages(ndefPayload)
const hexString   = ndefPayload.toString('hex').toUpperCase()

console.log('')
console.log('===============================================')
console.log('  CyberCard NDEF Payload Generator')
console.log('  Furulie LLC / CyberFlipper')
console.log('===============================================')
console.log('')
console.log(`  Card ID  : ${cardId}`)
console.log(`  URL      : ${rawUrl}`)
console.log(`  Bytes    : ${ndefPayload.length}`)
console.log(`  Pages    : ${pages.length} (NTAG216 pages 4-${3 + pages.length})`)
console.log('')
console.log('-- Raw hex (copy to NFC Tools / Proxmark3) ----')
console.log('')
console.log('  ' + hexString)
console.log('')
console.log('-- Per-page breakdown -------------------------')
pages.forEach((p, i) => {
  console.log(`  Page ${(4 + i).toString().padStart(2, '0')}: ${p.toString('hex').toUpperCase()}`)
})
console.log('')
console.log('-- Write instructions -------------------------')
console.log('')
console.log('  Flipper Zero:')
console.log('    NFC -> Saved NFC -> Add Manually -> NTAG216')
console.log('    Paste above hex into NDEF payload')
console.log('')
console.log('  Proxmark3:')
console.log(`    hf mfu ndefwrite -d ${hexString.toLowerCase()}`)
console.log('')
console.log('  NFC Tools (Android):')
console.log('    Write -> URL -> paste full URL')
console.log('')
console.log('  This firmware (ESP32):')
console.log('    Set TAP_URL in cybercard_v0.ino -> flash -> MODE_NFC_WRITE -> tap tag')
console.log('')
console.log('===============================================')
console.log('')
