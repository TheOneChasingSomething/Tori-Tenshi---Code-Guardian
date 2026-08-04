import { ProcessRunner } from './ProcessRunner';
import { Finding, Severity } from '../core/Types';

/** Subset of the `qemu-img info --output=json` schema we care about. */
interface QemuImageInfo {
  format?: string;
  'virtual-size'?: number;
  'actual-size'?: number;
  'backing-filename'?: string;
  'format-specific'?: { type?: string };
}

/**
 * Read-only QEMU integration. Runs `qemu-img info` to surface disk-image
 * metadata (format, sizes, backing file). This is deliberately inspection-only:
 * no VM is booted and no guest code is executed, keeping the local-only privacy
 * guarantee intact. Booting images for behavioural analysis is out of scope and
 * intentionally not implemented.
 */
export class QemuInspector {
  readonly command = 'qemu-img';
  /** Disk-image extensions worth inspecting. */
  static readonly EXTENSIONS = ['.qcow2', '.qcow', '.img', '.raw', '.vmdk', '.vdi', '.vhd', '.vhdx'];

  async inspect(absolutePath: string, relativePath: string, runner: ProcessRunner, timeoutMs: number): Promise<Finding[]> {
    const res = await runner.run(this.command, ['info', '--output=json', absolutePath], { timeoutMs });
    if (res.spawnError) {
      return [];
    }
    let info: QemuImageInfo;
    try {
      info = JSON.parse(res.stdout || '{}') as QemuImageInfo;
    } catch {
      return [];
    }
    const parts = [
      info.format ? `format=${info.format}` : undefined,
      info['virtual-size'] !== undefined ? `virtual-size=${info['virtual-size']}` : undefined,
      info['backing-filename'] ? `backing=${info['backing-filename']}` : undefined,
    ].filter(Boolean);

    // A backing file is worth flagging (the image depends on another artifact).
    const severity = info['backing-filename'] ? Severity.Low : Severity.Info;
    return [
      {
        pluginId: 'qemu',
        ruleId: 'QEMU-INFO',
        message: `Disk image (${parts.join(', ') || 'metadata unavailable'}).`,
        severity,
        range: { file: relativePath, startLine: 0, startChar: 0, endLine: 0, endChar: 0 },
      },
    ];
  }
}
