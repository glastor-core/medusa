/**
 * GLASTOR® Medusa - Edge Stream Compression Engine
 * Web-standard CompressionStream (gzip / deflate) for sub-millisecond payload reduction.
 */

export interface CompressionMetrics {
  compressedResponses: number;
  bypassedResponses: number;
}

class EdgeCompressor {
  private compressedCount = 0;
  private bypassedCount = 0;

  compress(req: Request, res: Response): Response {
    // Skip empty or already-encoded responses
    if (
      !res.body || res.headers.has("Content-Encoding") || res.status === 204 || res.status === 304
    ) {
      this.bypassedCount++;
      return res;
    }

    const acceptEncoding = req.headers.get("accept-encoding") || "";
    let format: "gzip" | "deflate" | null = null;

    if (acceptEncoding.includes("gzip")) {
      format = "gzip";
    } else if (acceptEncoding.includes("deflate")) {
      format = "deflate";
    }

    // Client does not support compression
    if (!format || typeof CompressionStream !== "function") {
      this.bypassedCount++;
      return res;
    }

    try {
      const stream = res.body.pipeThrough(new CompressionStream(format));
      const headers = new Headers(res.headers);
      headers.set("Content-Encoding", format);
      headers.append("Vary", "Accept-Encoding");
      headers.delete("Content-Length"); // Dynamic compressed stream

      this.compressedCount++;
      return new Response(stream, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err) {
      console.warn("[Glastor-Compressor] Failed stream compression, serving raw:", err);
      this.bypassedCount++;
      return res;
    }
  }

  getMetrics(): CompressionMetrics {
    return {
      compressedResponses: this.compressedCount,
      bypassedResponses: this.bypassedCount,
    };
  }
}

export const edgeCompressor = new EdgeCompressor();
