export type GcsRef = { bucket: string; name: string }

export async function uploadToGCS(opts: {
  buffer: Buffer
  contentType: string
  destName: string
  originalName: string
}): Promise<GcsRef> {
  const bucketName = process.env.GCS_BUCKET
  if (!bucketName) throw new Error('GCS_BUCKET env is required')
  // dynamic import to keep optional until configured
  const { Storage } = await import('@google-cloud/storage')
  const storage = new Storage()
  const bucket = storage.bucket(bucketName)
  const file = bucket.file(opts.destName)
  await file.save(opts.buffer, {
    resumable: false,
    contentType: opts.contentType,
    metadata: {
      metadata: { originalName: opts.originalName },
      contentDisposition: `attachment; filename="${opts.originalName.replaceAll('"', '')}"`,
    },
  })
  // Make the object public so it can be served via a public URL
  try {
    await file.makePublic()
  } catch {}
  return { bucket: bucketName, name: opts.destName }
}

export function getGCSPublicUrl(ref: GcsRef) {
  const name = encodeURIComponent(ref.name)
  return `https://storage.googleapis.com/${ref.bucket}/${name}`
}

export async function deleteFromGCS(ref: GcsRef) {
  const { Storage } = await import('@google-cloud/storage')
  const storage = new Storage()
  const file = storage.bucket(ref.bucket).file(ref.name)
  try {
    await file.delete({ ignoreNotFound: true })
  } catch {}
}
