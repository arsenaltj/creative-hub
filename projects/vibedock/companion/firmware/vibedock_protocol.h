#ifndef VIBEDOCK_PROTOCOL_H
#define VIBEDOCK_PROTOCOL_H
#include <stdint.h>
/* Transport contract only. SDK BLE, JSON, touchscreen and rendering APIs are board specific. */
#define VD_SERVICE_UUID "7b35a100-9c52-4f97-8e4d-d94275da6f10"
#define VD_SNAPSHOT_UUID "7b35a101-9c52-4f97-8e4d-d94275da6f10"
#define VD_TOUCH_UUID "7b35a102-9c52-4f97-8e4d-d94275da6f10"
#define VD_HEADER_BYTES 12
#define VD_MAX_MESSAGE_BYTES 65536
#define VD_MAX_INFLIGHT_MESSAGES 4
#define VD_FRAGMENT_TIMEOUT_MS 15000
enum vd_kind { VD_SNAPSHOT=1, VD_TOUCH=2, VD_ACK=3 };
/* Bytes 0..1 'VD', 2 version=1, 3 kind; u32LE id at 4, u16LE index at 8, u16LE count at 10. */
static inline uint16_t vd_u16le(const uint8_t *p) { return (uint16_t)(p[0]|((uint16_t)p[1]<<8)); }
static inline uint32_t vd_u32le(const uint8_t *p) { return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24); }
static inline int vd_valid_header(const uint8_t *p, uint32_t n) {
 if(n<=VD_HEADER_BYTES||p[0]!='V'||p[1]!='D'||p[2]!=1||p[3]<1||p[3]>3)return 0;
 uint16_t count=vd_u16le(p+10);return count>0&&count<=8192&&vd_u16le(p+8)<count;
}
#endif
