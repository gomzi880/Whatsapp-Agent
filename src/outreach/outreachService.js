/**
 * Outreach Service: Manages live Baileys WhatsApp socket connection for outbound campaigns
 */

let activeSocket = null;

/**
 * Register the active Baileys socket connection from index.js
 */
export function registerWhatsAppSocket(sock) {
  activeSocket = sock;
  console.log('📡 [Outreach Service] WhatsApp socket registered successfully.');
}

/**
 * Check if the WhatsApp socket is active and connected
 */
export function isWhatsAppConnected() {
  return activeSocket !== null && activeSocket.ws?.readyState === 1;
}

/**
 * Get active socket instance
 */
export function getWhatsAppSocket() {
  return activeSocket;
}

/**
 * Sends a message via the active WhatsApp socket
 * @param {string} jid Target WhatsApp JID (e.g. 918358826116@s.whatsapp.net)
 * @param {string} text Message content
 * @returns {Promise<object>} Message result
 */
export async function sendWhatsAppMessage(jid, text) {
  if (!activeSocket) {
    throw new Error('WhatsApp socket is not connected. Please ensure index.js is running.');
  }

  // Format JID if raw phone number was passed
  let targetJid = jid;
  if (!targetJid.includes('@')) {
    targetJid = `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  }

  // Mark typing presence
  try {
    await activeSocket.sendPresenceUpdate('composing', targetJid);
    await new Promise(r => setTimeout(r, 1500)); // Brief human simulation
    const result = await activeSocket.sendMessage(targetJid, { text });
    await activeSocket.sendPresenceUpdate('paused', targetJid);
    return result;
  } catch (err) {
    if (activeSocket) {
      await activeSocket.sendPresenceUpdate('paused', targetJid).catch(() => {});
    }
    throw err;
  }
}
