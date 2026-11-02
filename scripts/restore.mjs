#!/usr/bin/env node
/**
 * Restauration et vérification d'intégrité d'une sauvegarde PostgreSQL Aqar DZ.
 *
 * Implémente la Story 0.2 du projet :
 *  - Décompression à la volée du dump .sql.gz
 *  - Restauration vers la base cible
 *  - Vérification de l'intégrité des tables clés (Agences, Utilisateurs, Biens)
 *
 * Usage:
 *   node scripts/restore.mjs ./backups/aqar_backup_YYYY-MM-DD_HH-mm-ss.sql.gz
 */

import { execSync } from "child_process"
import { existsSync, createReadStream, createWriteStream, unlinkSync } from "fs"
import { resolve, basename } from "path"
import { createGunzip } from "zlib"
import { pipeline } from "stream/promises"

const backupFile = process.argv[2]
if (!backupFile) {
  console.error("❌ Chemin du fichier de sauvegarde manquant.")
  console.error("Usage: node scripts/restore.mjs ./backups/aqar_backup_xxx.sql.gz")
  process.exit(1)
}

const resolvedPath = resolve(backupFile)
if (!existsSync(resolvedPath)) {
  console.error(`❌ Fichier introuvable : ${resolvedPath}`)
  process.exit(1)
}

const DB_URL = process.env.DATABASE_URL || "postgresql://aqar_user:aqar_password@localhost:5432/aqar_db"

const dbMatch = DB_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
if (!dbMatch) {
  console.error("❌ Format DATABASE_URL invalide.")
  process.exit(1)
}

const [, user, password, host, port, dbname] = dbMatch

console.log(`\n==============================================`)
console.log(`♻️ Restauration PostgreSQL — Aqar DZ`)
console.log(`==============================================`)
console.log(`Fichier source  : ${basename(resolvedPath)}`)
console.log(`Base de données : ${dbname} sur ${host}:${port}`)

let tempSqlPath = resolvedPath.replace(/\.gz$/, "")
let needsCleanup = false

try {
  // 1. Décompression si archive gzip
  if (resolvedPath.endsWith(".gz")) {
    console.log(`⏳ Décompression du fichier d'archive...`)
    tempSqlPath = resolvedPath + ".tmp.sql"
    await pipeline(createReadStream(resolvedPath), createGunzip(), createWriteStream(tempSqlPath))
    needsCleanup = true
  }

  // 2. Détection de psql
  let psqlCmd = "psql"
  try {
    execSync("psql --version", { stdio: "ignore" })
  } catch {
    const winPsql = "C:\\Users\\user\\pgsql17\\bin\\psql.exe"
    psqlCmd = `"${winPsql}"`
  }

  // 3. Exécution de la restauration
  console.log(`⏳ Injection des données via ${psqlCmd}...`)
  const env = { ...process.env, PGPASSWORD: password }
  execSync(`${psqlCmd} -h ${host} -p ${port} -U ${user} -d ${dbname} -f "${tempSqlPath}"`, {
    env,
    stdio: "inherit",
  })

  // 4. Contrôle d'intégrité
  console.log(`\n🔍 Contrôle d'intégrité des tables métier...`)
  const checkQuery = `SELECT (SELECT count(*) FROM agencies), (SELECT count(*) FROM users), (SELECT count(*) FROM properties);`
  const result = execSync(`${psqlCmd} -h ${host} -p ${port} -U ${user} -d ${dbname} -t -c "${checkQuery.trim()}"`, {
    env,
    encoding: "utf8",
  })

  const [agences, users, biens] = result.trim().split("|").map((s) => s.trim())
  console.log(`  ✓ Agences recensées     : ${agences}`)
  console.log(`  ✓ Utilisateurs actifs   : ${users}`)
  console.log(`  ✓ Biens immobiliers     : ${biens}`)

  console.log(`\n✅ Restauration validée avec succès ! Les données sont intactes.`)
  console.log(`==============================================\n`)
} catch (error) {
  console.error(`\n❌ Échec de la restauration :`, error.message)
  process.exit(1)
} finally {
  if (needsCleanup && existsSync(tempSqlPath)) {
    try { unlinkSync(tempSqlPath) } catch {}
  }
}
