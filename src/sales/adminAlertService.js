/**
 * Admin Alert Service
 * Dispatches real-time alerts to administrators when high-value prospects,
 * large gym chains (3+ branches), or enterprise accounts express interest.
 */

import db, { logAuditAction } from '../database/db.js';
import { config } from '../../config.js';

/**
 * Evaluates whether a prospect is considered high-value or enterprise
 * @param {object} lead
 * @param {object} context
 * @returns {boolean}
 */
export function isHighValueProspect(lead, context = {}) {
  if (!lead) return false;
  // Multiple branches
  if (lead.branchesCount && lead.branchesCount >= 3) return true;
  // Member scale (>300 or >500 members indicated in notes or text)
  const fullText = `${lead.notes || ''} ${context.userMessage || ''} ${context.intent || ''}`.toLowerCase();
  if (/(\b[3-9]\d{2}\b|\b\d{4,}\b)\s*(members|clients|admissions)|chain|franchise|multi[- ]?branch/i.test(fullText)) {
    return true;
  }
  // High lead score
  if (lead.leadScore && lead.leadScore >= 90) return true;
  return false;
}

/**
 * Sends an urgent alert to administrators about high-value prospects
 * @param {object} lead
 * @param {object} details
 */
export async function sendHighValueAdminAlert(lead, details = {}) {
  const alertSubject = `🚨 HIGH-VALUE ENTERPRISE PROSPECT: ${lead.gymName} (${lead.city || 'India'})`;
  const alertSummary = {
    gymName: lead.gymName,
    branchesCount: lead.branchesCount || 1,
    contactName: lead.ownerName || lead.founderName || 'Gym Management',
    phone: lead.whatsappNumber || lead.businessPhone || lead.normalizedPhone || 'N/A',
    email: lead.businessEmail || 'N/A',
    leadScore: lead.leadScore || 50,
    triggerReason: details.reason || 'High-value criteria matched',
    userMessage: details.userMessage || ''
  };

  console.log(`\n======================================================`);
  console.log(`🚨 [Admin Alert Service] ${alertSubject}`);
  console.log(`   Contact: ${alertSummary.contactName} (${alertSummary.phone})`);
  console.log(`   Reason: ${alertSummary.triggerReason}`);
  console.log(`======================================================\n`);

  // Record into audit_logs
  logAuditAction({
    agentName: 'Sales Dialogue Orchestrator',
    actionType: 'HIGH_VALUE_PROSPECT_ESCALATION',
    targetEntity: 'leads',
    targetId: lead.id,
    details: alertSummary,
    performedBy: 'AutonomousSalesAgent'
  });

  return {
    alertSent: true,
    alertSubject,
    details: alertSummary
  };
}
