
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export default async function handler(req, res) {
  const host = req.headers.host?.split(':')[0];
  const rpID = host || "localhost";

  const options = await generateAuthenticationOptions({
    rpID: rpID,
    allowCredentials: [],
    userVerification: "preferred",
  });

  // Note: En production, on stockerait le challenge dans la session de l'utilisateur
  res.status(200).json(options);
}
