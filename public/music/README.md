# Nhạc nền thiệp

| File | Giai điệu | Nguồn gốc giai điệu |
|---|---|---|
| `lo-suoi.mp3` | Jingle Bells (điệp khúc) | J. Pierpont, 1857. Phạm vi công cộng. |
| `dem-thanh.mp3` | Silent Night (Đêm Thánh vô cùng) | F. X. Gruber, 1818. Phạm vi công cộng. |
| `gala.mp3` | We Wish You a Merry Christmas | Dân ca Anh. Phạm vi công cộng. |

Bản ghi âm do TRAO tự tổng hợp bằng `scripts/music/synth.py` (không dùng mẫu âm thanh của bên thứ ba),
nên không có chủ sở hữu bản ghi nào khác. Tạo lại: `python3 scripts/music/synth.py public/music` (cần numpy, ffmpeg).

Thêm bài mới: chỉ dùng giai điệu đã hết bảo hộ hoặc nhạc có giấy phép rõ ràng (vd Pixabay), ghi nguồn và ngày tải vào bảng này,
rồi khai báo trong `src/features/invitations/templates/festive/music.ts`.
