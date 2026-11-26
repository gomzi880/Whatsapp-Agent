/**
 * Email Outreach Campaign Manager & Orchestrator
 * 
 * Manages email campaigns with safety guards:
 * - Staged administrator approval
 * - Pacing & rate-limiting (3-5s between emails)
 * - Strict deduplication (7-day rule, no duplicate recipients)
 * - Opt-out enforcement (unsubscribed leads are completely excluded)
 * - Authorized sender validation (info@, sales@, support@ gymstack.in)
 * - Knowledge base safety verification (isOutreachApproved)
 */

import {
  createEmailCampaign,
  updateEmailCampaign,
  getEmailCampaignById,
  getEmailCampaigns,
  getEligibleLeadsForEmailOutreach,
  updateLeadStatus,
  getLeadById
} from '../database/db.js';
import { isOutreachApproved } from '../knowledge/knowledgeService.js';
import { sendEmail } from './emailService.js';
import { buildEmail, isAuthorizedSender } from './emailTemplates.js';
import { getBrochureAttachment } from './brochureService.js';

// Map of active execution abort controllers
const activeCampaignControllers = new Map();

/**
 * Creates a new email campaign staged for administrator approval
 */
export function createEmailOutreachCampaign(data) {
  const safeFrom = isAuthorizedSender(data.fromEmail) ? data.fromEmail : 'sales@gymstack.in';

  // Check eligible lead count
  const eligibleLeads = getEligibleLeadsForEmailOutreach({
    country: data.targetCountry,
    city: data.targetCity,
    category: data.targetCategory,
    minScore: data.minLeadScore || 50,
    limit: 1000
  });

  const campaign = createEmailCampaign({
    name: data.name || `Email Campaign - ${new Date().toLocaleDateString()}`,
    fromEmail: safeFrom,
    targetCountry: data.targetCountry || 'All',
    targetCity: data.targetCity || 'All',
    targetCategory: data.targetCategory || 'All',
    minLeadScore: data.minLeadScore !== undefined ? parseInt(data.minLeadScore, 10) : 50,
    dailyLimit: data.dailyLimit !== undefined ? parseInt(data.dailyLimit, 10) : 20,
    status: 'pending_approval',
    subject: data.subject || null,
    templateType: data.templateType || 'introductory',
    customMessage: data.customMessage || null
  });

  updateEmailCampaign(campaign.id, {
    totalEligible: eligibleLeads.length
  });

  return {
    ...campaign,
    totalEligible: eligibleLeads.length
  };
}

/**
 * Approves a campaign for launch
 */
export function approveEmailCampaign(campaignId) {
  const campaign = getEmailCampaignById(campaignId);
  if (!campaign) {
    throw new Error(`Email Campaign #${campaignId} not found.`);
  }

  updateEmailCampaign(campaignId, { status: 'approved' });
  return { success: true, message: `Email Campaign #${campaignId} approved.` };
}

/**
 * Pauses a currently running campaign
 */
export function pauseEmailCampaign(campaignId) {
  const controller = activeCampaignControllers.get(campaignId);
  if (controller) {
    controller.aborted = true;
    activeCampaignControllers.delete(campaignId);
  }

  updateEmailCampaign(campaignId, { status: 'paused' });
  return { success: true, message: `Email Campaign #${campaignId} paused.` };
}

/**
 * Cancels a campaign
 */
export function cancelEmailCampaign(campaignId) {
  pauseEmailCampaign(campaignId);
  updateEmailCampaign(campaignId, { status: 'cancelled' });
  return { success: true, message: `Email Campaign #${campaignId} cancelled.` };
}

/**
 * Starts execution of an approved or paused email campaign
 */
export async function startEmailCampaign(campaignId) {
  const campaign = getEmailCampaignById(campaignId);
  if (!campaign) {
    throw new Error(`Email Campaign #${campaignId} not found.`);
  }

  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    throw new Error(`Campaign must be "approved" or "paused" to start. Current status: "${campaign.status}".`);
  }

  // Safety guard: Product Knowledge verification
  if (!isOutreachApproved()) {
    throw new Error('Automated email outreach cannot start until the Administrator confirms that the Product Knowledge Base is accurate.');
  }

  if (activeCampaignControllers.has(campaignId)) {
    throw new Error(`Campaign #${campaignId} is already running.`);
  }

  const controller = { aborted: false };
  activeCampaignControllers.set(campaignId, controller);

  updateEmailCampaign(campaignId, {
    status: 'running',
    startedAt: campaign.startedAt || new Date().toISOString()
  });

  // Execute asynchronously in background
  executeEmailCampaignBatch(campaignId, controller).catch((err) => {
    console.error(`❌ [Email Campaign #${campaignId} error]:`, err.message);
    updateEmailCampaign(campaignId, {
      status: 'failed',
      errorMessage: err.message
    });
    activeCampaignControllers.delete(campaignId);
  });

  return { success: true, message: `Email Campaign #${campaignId} started.` };
}

/**
 * Executes sending of emails with rate limiting & pacing
 */
async function executeEmailCampaignBatch(campaignId, controller) {
  const campaign = getEmailCampaignById(campaignId);
  if (!campaign) return;

  console.log(`🚀 [Email Campaign #${campaignId}] Running batch: "${campaign.name}" from ${campaign.fromEmail}...`);

  const dailyLimit = campaign.dailyLimit || 20;
  const alreadySent = campaign.sentCount || 0;
  const remainingToday = Math.max(0, dailyLimit - alreadySent);

  if (remainingToday <= 0) {
    console.log(`ℹ️ [Email Campaign #${campaignId}] Daily limit (${dailyLimit}) already reached for today.`);
    updateEmailCampaign(campaignId, { status: 'paused' });
    activeCampaignControllers.delete(campaignId);
    return;
  }

  const eligibleLeads = getEligibleLeadsForEmailOutreach({
    country: campaign.targetCountry,
    city: campaign.targetCity,
    category: campaign.targetCategory,
    minScore: campaign.minLeadScore || 50,
    limit: remainingToday
  });

  if (eligibleLeads.length === 0) {
    console.log(`✅ [Email Campaign #${campaignId}] No remaining eligible leads. Marking completed.`);
    updateEmailCampaign(campaignId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    activeCampaignControllers.delete(campaignId);
    return;
  }

  console.log(`📧 [Email Campaign #${campaignId}] Processing ${eligibleLeads.length} leads with pacing...`);

  // Pre-load brochure if template requires it
  let brochureAttachment = null;
  if (campaign.templateType === 'product_details') {
    try {
      brochureAttachment = await getBrochureAttachment();
    } catch (e) {
      console.warn('Could not generate brochure attachment:', e.message);
    }
  }

  let sentThisRun = 0;
  let failedThisRun = 0;

  for (const lead of eligibleLeads) {
    if (controller.aborted) {
      console.log(`⏸️ [Email Campaign #${campaignId}] Aborted by controller.`);
      break;
    }

    // Safety re-check on lead status
    const freshLead = getLeadById(lead.id);
    if (!freshLead || freshLead.status === 'Unsubscribed' || freshLead.status === 'Not Interested') {
      console.log(`⏩ [Email Campaign #${campaignId}] Skipping Lead #${lead.id} (status: ${freshLead?.status}).`);
      continue;
    }

    try {
      const emailContent = buildEmail({
        templateType: campaign.templateType || 'introductory',
        lead: freshLead,
        customMessage: campaign.customMessage,
        fromEmail: campaign.fromEmail
      });

      const attachments = (emailContent.attachBrochure && brochureAttachment) ? [brochureAttachment] : [];

      console.log(`📨 [Email Campaign #${campaignId}] Sending to: ${freshLead.businessEmail} (${freshLead.gymName})...`);

      const result = await sendEmail({
        to: freshLead.businessEmail,
        from: campaign.fromEmail,
        subject: campaign.subject || emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments,
        leadId: freshLead.id,
        campaignId,
        templateType: campaign.templateType
      });

      if (result.success) {
        sentThisRun++;
        updateLeadStatus(freshLead.id, 'Contacted');
      } else {
        failedThisRun++;
      }

      // Update campaign counters in DB
      const current = getEmailCampaignById(campaignId);
      updateEmailCampaign(campaignId, {
        sentCount: (current.sentCount || 0) + (result.success ? 1 : 0),
        failedCount: (current.failedCount || 0) + (result.success ? 0 : 1),
        deliveredCount: (current.deliveredCount || 0) + (result.success ? 1 : 0)
      });

      // Pacing delay (3.5 seconds) between emails to prevent spam flags
      await new Promise(r => setTimeout(r, 3500));
    } catch (err) {
      console.error(`❌ [Email Campaign #${campaignId}] Failed to send to Lead #${lead.id}:`, err.message);
      failedThisRun++;
      const current = getEmailCampaignById(campaignId);
      updateEmailCampaign(campaignId, {
        failedCount: (current.failedCount || 0) + 1
      });
    }
  }

  activeCampaignControllers.delete(campaignId);
  const finalState = getEmailCampaignById(campaignId);

  if (finalState.sentCount >= finalState.totalEligible && finalState.totalEligible > 0) {
    updateEmailCampaign(campaignId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    console.log(`🎉 [Email Campaign #${campaignId}] Completed! Total sent: ${finalState.sentCount}`);
  } else {
    updateEmailCampaign(campaignId, { status: 'paused' });
    console.log(`⏸️ [Email Campaign #${campaignId}] Run finished. Sent: ${sentThisRun}, Failed: ${failedThisRun}. Status paused.`);
  }
}
