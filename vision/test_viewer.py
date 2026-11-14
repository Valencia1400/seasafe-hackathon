"""python -m unittest test_viewer -v   (from vision/, no camera or model needed)"""
import io
import unittest

from viewer import mjpeg_frames, udp_frame


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


def dgram(fid, idx, count, data):
    return b"SC" + bytes([fid & 255, fid >> 8, idx, count]) + data


class UdpFrames(unittest.TestCase):
    def test_reassembles_out_of_order_and_skips_a_frame_with_a_lost_chunk(self):
        state, got = {}, []
        packets = [dgram(1, 1, 3, b"B"), dgram(1, 0, 3, b"A"), dgram(1, 2, 3, b"C"),   # frame 1, out of order
                   dgram(2, 0, 3, b"x"), dgram(2, 2, 3, b"z"),                          # frame 2 loses chunk 1
                   dgram(300, 0, 2, b"L"), dgram(300, 1, 2, b"R"),                      # frame id needs both bytes
                   b"junk", dgram(4, 5, 2, b"bad index")]
        for p in packets:
            jpg = udp_frame(state, p)
            if jpg:
                got.append(jpg)
        self.assertEqual(got, [b"ABC", b"LR"])


if __name__ == "__main__":
    unittest.main()
