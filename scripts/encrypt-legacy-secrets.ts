/** Run ONCE after configuring SHILOH_SETTINGS_ENCRYPTION_KEY. */
import { PrismaClient } from "@prisma/client";
import { encryptSettingSecret } from "../src/lib/secret-settings";
const db = new PrismaClient();
async function main() {
  for (const key of ["hubtel_client_secret", "sms_client_secret", "smtp_pass"]) {
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value && !row.value.startsWith("enc:v1:")) {
      await db.setting.update({ where: { key }, data: { value: encryptSettingSecret(row.value) } });
      console.log("Encrypted legacy setting:", key);
    }
  }
}
main().finally(async () => db.$disconnect());
