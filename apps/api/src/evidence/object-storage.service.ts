import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import type { Readable } from "node:stream";

import { getConfig } from "../config.js";

@Injectable()
export class ObjectStorageService {
  private readonly config = getConfig();
  private readonly client = new S3Client({
    endpoint: this.config.OBJECT_STORAGE_ENDPOINT,
    region: this.config.OBJECT_STORAGE_REGION,
    credentials: {
      accessKeyId: this.config.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: this.config.OBJECT_STORAGE_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  async put(key: string, body: Buffer, contentType: string, sha256: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.OBJECT_STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      Metadata: { sha256 },
    }));
  }

  async putStream(
    key: string,
    body: Readable,
    contentType: string,
    contentLength: number,
    sha256: string,
  ): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.OBJECT_STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      Metadata: { sha256 },
    }));
  }

  async get(key: string): Promise<{ body: Buffer; contentType?: string; contentLength?: number }> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.config.OBJECT_STORAGE_BUCKET,
      Key: key,
    }));
    if (!response.Body) {
      throw new Error("ที่เก็บไฟล์ส่งข้อมูลหลักฐานไม่ถูกต้อง");
    }
    const bytes = await response.Body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: response.ContentType, contentLength: response.ContentLength };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.OBJECT_STORAGE_BUCKET, Key: key }));
  }

  async ready(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.OBJECT_STORAGE_BUCKET }));
  }
}
