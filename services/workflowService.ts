import type { Lead, Workflow, Action, TriggerType } from '../types';

function parseSchedule(scheduleString: string): string {
    const now = new Date();
    switch (scheduleString) {
        case 'tomorrow_9am':
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return tomorrow.toISOString().slice(0, 16);
        case '+1h':
            now.setHours(now.getHours() + 1);
            return now.toISOString().slice(0, 16);
        case '+1d':
            now.setDate(now.getDate() + 1);
            return now.toISOString().slice(0, 16);
        case '+7d':
            now.setDate(now.getDate() + 7);
            return now.toISOString().slice(0, 16);
        default:
            return '';
    }
}

function applyAction(lead: Lead, action: Action): Lead {
    let newLead = { ...lead };
    switch (action.type) {
        case 'add_tag':
            if (typeof action.value === 'string') {
                const currentTags = new Set(newLead.tags || []);
                currentTags.add(action.value);
                newLead.tags = Array.from(currentTags);
            }
            break;
        case 'remove_tag':
            if (typeof action.value === 'string' && newLead.tags) {
                newLead.tags = newLead.tags.filter(t => t !== action.value);
            }
            break;
        case 'move_to_persistent':
            newLead.favorite = true;
            break;
        case 'set_schedule':
            if (typeof action.value === 'string') {
                newLead.scheduleISO = parseSchedule(action.value);
            }
            break;
        case 'set_priority':
            if (typeof action.value === 'number') {
                newLead.priority = action.value;
            }
            break;
        case 'clear_schedule':
            newLead.scheduleISO = '';
            break;
    }
    return newLead;
}

export function checkAndApplyWorkflows(
    lead: Lead, 
    triggerType: TriggerType, 
    workflows: Workflow[],
    triggerValue?: any
): { updatedLead: Lead, appliedWorkflow: boolean } {
    if (!workflows || workflows.length === 0) {
        return { updatedLead: lead, appliedWorkflow: false };
    }
    
    let updatedLead = { ...lead };
    let appliedWorkflow = false;

    for (const workflow of workflows) {
        const { trigger } = workflow;
        let isTriggered = false;

        if (trigger.type === triggerType) {
            switch (trigger.type) {
                case 'status_change':
                    isTriggered = String(trigger.value) === String(triggerValue);
                    break;
                case 'new_attempt':
                    isTriggered = Number(trigger.value) === Number(triggerValue);
                    break;
                case 'tag_added':
                    isTriggered = String(trigger.value).toLowerCase() === String(triggerValue).toLowerCase();
                    break;
                case 'added_to_persistent':
                case 'lead_imported':
                    isTriggered = true;
                    break;
                case 'on_hold_for_days':
                     if (lead.onHold && lead.onHoldSince) {
                        const daysOnHold = (Date.now() - lead.onHoldSince) / (1000 * 60 * 60 * 24);
                        isTriggered = daysOnHold >= (trigger.value as number);
                    }
                    break;
            }
        }
        
        if (isTriggered) {
            appliedWorkflow = true;
            for (const action of workflow.actions) {
                updatedLead = applyAction(updatedLead, action);
            }
        }
    }
    return { updatedLead, appliedWorkflow };
}