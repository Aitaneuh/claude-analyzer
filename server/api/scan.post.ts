export default defineEventHandler(() => {
  const dir = process.env.CLAUDE_PROJECTS_DIR
  if (!dir) throw createError({ statusCode: 400, statusMessage: 'CLAUDE_PROJECTS_DIR is not set; data arrives via the sync script' })
  return scanDirectory(dir)
})
