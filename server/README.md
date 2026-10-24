# 🎬 QPI Messenger Video Upload & Streaming Architecture

이 디렉토리(`server/`) 및 프론트엔드 시스템은 **대용량 동영상 업로드(최대 45MB), 저부하 HDD 파이프라인, 고성능 스트리밍 서빙**을 위해 지시하신 4대 가이드라인을 100% 만족하도록 설계 및 구현되었습니다.

---

## 🏗️ 1. 클라이언트 사이드 전처리 (Client-Side Preprocessing)
- **서버 트랜스코딩(인코딩) 금지**: 서버 CPU 부하 및 FFmpeg 인코딩 병목을 완전히 제거하기 위해 서버 내부 비디오 변환 작업을 원천 금지합니다.
- **클라이언트 압축 및 최적화**: 프론트엔드(`src/utils/videoOptimizer.ts`)에서 업로드 전에 모바일 최적화 포맷(H.264/AAC, MP4 컨테이너) 여부를 검증하고 45MB 상한선을 사전 제어합니다.
- **썸네일 동시 업로드**: 서버에서 비디오의 프레임을 추출하지 않습니다. 클라이언트에서 HTML5 `<video>` 및 `<canvas>` API를 이용해 **첫번째 프레임(0.1초 지점)을 자동 추출하여 썸네일(`image/jpeg`) 파일로 생성**한 뒤, 비디오와 함께 썸네일을 동시 전송합니다.

---

## 🚀 2. 메모리 관리 (Memory Optimization)
- **스트리밍 업로드 구현 (`upload-service.js`)**: Node.js의 `busboy` 스트리밍 라이브러리를 사용하여, 네트워크로 유입되는 비디오 데이터 스트림을 메모리(RAM) 버퍼에 누적하지 않고 **곧바로 HDD 물리 파일로 Write하는 파이프라인(`fileStream.pipe(writeStream)`)**을 적용했습니다.
- **인메모리 버퍼 제한**: 멀티파트 스트림 파싱 시 `highWaterMark: 1MB`로 인메모리 버퍼 상한값을 최소 수준으로 설정하여 다수 동시 업로드 시에도 **OOM(Out of Memory) 현상을 원천 예방**합니다.

---

## 💾 3. 스토리지 및 I/O 제어 (Storage & I/O Control)
- **파일 크기 상한선 설정**: 동영상 업로드 용량 상한을 **최대 45MB**로 명확히 제한합니다 (클라이언트 및 백엔드 API, Nginx `client_max_body_size` 3중 제어).
- **디스크 정리 자동화 (`cron-cleanup.js`)**: 1TB HDD 용량 보호를 위해 물리 디스크를 스캔하여 **업로드된 지 30일이 지난 만료 동영상을 자동으로 물리 삭제(unlink)**하는 백그라운드 태스크 스크립트 및 데이몬(`npm run cleanup:daemon`)을 제공합니다.

---

## 🌐 4. 서빙 및 네트워크 (Streaming & Serving)
- **Nginx 정적 서빙 위임 (`nginx.conf`)**: 동영상 다운로드 및 재생 요청 시 Node.js나 Matrix 백엔드 애플리케이션을 거치지 않고, 프론트단의 Nginx가 디스크에서 물리 파일을 직접 읽어 전송합니다.
- **HTTP Range Requests (206 Partial Content) 활용**: Nginx의 `Accept-Ranges bytes` 기능을 활성화하여, 사용자가 동영상 시청 시 필요한 구간(Time/Byte Range)만 끊어서 즉시 내려받고 탐색(Seek)할 수 있습니다.
- **동시 접속 속도/커넥션 제한 (Rate Limiting)**: 느린 HDD의 I/O 병목 및 큐 대기 지연을 예방하기 위해, Nginx `limit_conn_zone` 및 `limit_rate`를 적용하여 IP당 커넥션을 제한하고, 초기 2MB 고속 버퍼링 이후 **초당 1.5MB(1500k)로 전송 대역폭을 제어**합니다.
