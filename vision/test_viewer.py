"""python -m unittest test_viewer -v   (from vision/, no camera or model needed)"""
import io
import unittest

from viewer import mjpeg_frames


def part(jpg, extra=b"X-Timestamp: 123\r\n"):
    return b"\r\n--seasafeframe\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n%s\r\n%s" % (len(jpg), extra, jpg)


class MjpegParser(unittest.TestCase):
    def test_reads_each_frame_whole(self):
        a, b = b"\xff\xd8first\r\n--seasafeframe\xff\xd9", b"\xff\xd8second\xff\xd9"  # a contains a fake boundary
        stream = io.BytesIO(part(a) + part(b, extra=b""))
        self.assertEqual(list(mjpeg_frames(stream)), [a, b])

    def test_drops_frame_cut_mid_way(self):
        stream = io.BytesIO(part(b"\xff\xd8ok\xff\xd9") + part(b"\xff\xd8truncated\xff\xd9")[:-4])
        self.assertEqual(list(mjpeg_frames(stream)), [b"\xff\xd8ok\xff\xd9"])


if __name__ == "__main__":
    unittest.main()
