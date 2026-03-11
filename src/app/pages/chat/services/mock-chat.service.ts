import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';

import { ChatContextPayload, ChatMessage } from '../models/chat.model';
import { ChatService } from './chat.service';

/**
 * Mock implementation of ChatService that returns context-aware
 * canned responses with a simulated delay.
 */
@Injectable()
export class MockChatService extends ChatService {
  sendMessage(
    message: string,
    context: ChatContextPayload,
    history: ChatMessage[],
  ): Observable<ChatMessage> {
    const delay = 500 + Math.random() * 1000;
    const response = this.generateResponse(message, context, history);

    return timer(delay).pipe(
      map(() => ({
        id: crypto.randomUUID(),
        sessionId: '',
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString(),
      })),
    );
  }

  private generateResponse(
    message: string,
    context: ChatContextPayload,
    history: ChatMessage[],
  ): string {
    const entityCounts = this.countEntities(context);
    const tmName = context.threatModel.name;
    const framework = context.threatModel.framework;
    const lower = message.toLowerCase();

    if (history.length === 0 || lower.includes('hello') || lower.includes('hi')) {
      return this.greeting(tmName, framework, entityCounts);
    }

    if (lower.includes('threat')) {
      return this.threatSummary(context, entityCounts);
    }

    if (lower.includes('asset')) {
      return this.assetSummary(context, entityCounts);
    }

    if (lower.includes('diagram') || lower.includes('dfd')) {
      return this.diagramSummary(context, entityCounts);
    }

    if (lower.includes('summar')) {
      return this.overallSummary(tmName, framework, entityCounts);
    }

    return this.genericResponse(tmName, entityCounts);
  }

  private greeting(tmName: string, framework: string, counts: Record<string, number>): string {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
      `Hi! I'm **Timmy**, your threat modeling assistant. ` +
      `I'm looking at **${tmName}** which uses the **${framework}** framework.\n\n` +
      `I have **${total}** sources loaded in my context. ` +
      `Ask me about threats, assets, diagrams, or anything else in this model!`
    );
  }

  private threatSummary(context: ChatContextPayload, _counts: Record<string, number>): string {
    const threats = context.entities.filter(e => e.type === 'threat');
    if (threats.length === 0) {
      return (
        'No threats are currently included in my context. ' +
        'Try enabling some threats in the Sources panel.'
      );
    }

    const list = threats.map(t => `- **${t.name}**: ${t.summary.split('\n')[0]}`).join('\n');

    return (
      `I can see **${threats.length}** threat(s) in the current context:\n\n` +
      `${list}\n\n` +
      `Would you like me to analyze any of these in detail?`
    );
  }

  private assetSummary(context: ChatContextPayload, _counts: Record<string, number>): string {
    const assets = context.entities.filter(e => e.type === 'asset');
    if (assets.length === 0) {
      return (
        'No assets are currently included in my context. ' +
        'Try enabling some assets in the Sources panel.'
      );
    }

    const list = assets.map(a => `- **${a.name}**: ${a.summary.split('\n')[0]}`).join('\n');

    return (
      `There are **${assets.length}** asset(s) in scope:\n\n` +
      `${list}\n\n` +
      `Would you like to discuss the security posture of any specific asset?`
    );
  }

  private diagramSummary(context: ChatContextPayload, _counts: Record<string, number>): string {
    const diagrams = context.entities.filter(e => e.type === 'diagram');
    if (diagrams.length === 0) {
      return (
        'No diagrams are currently included in my context. ' +
        'Try enabling some diagrams in the Sources panel.'
      );
    }

    const list = diagrams.map(d => `- **${d.name}**: ${d.summary}`).join('\n');

    return (
      `I can see **${diagrams.length}** diagram(s):\n\n` +
      `${list}\n\n` +
      `*Note: In this mock mode, I can only describe diagram metadata. ` +
      `Full diagram analysis will be available when connected to an AI backend.*`
    );
  }

  private overallSummary(
    tmName: string,
    framework: string,
    counts: Record<string, number>,
  ): string {
    const lines = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `- **${type}**: ${count}`);

    return (
      `## Summary of ${tmName}\n\n` +
      `**Framework**: ${framework}\n\n` +
      `**Sources in context**:\n${lines.join('\n')}\n\n` +
      `Ask me about specific threats, assets, or any aspect of this threat model.`
    );
  }

  private genericResponse(tmName: string, counts: Record<string, number>): string {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
      `I'm analyzing **${tmName}** with **${total}** sources in context. ` +
      `This is a mock response — when connected to a real AI backend, ` +
      `I'll provide detailed analysis based on your question.\n\n` +
      `Try asking about:\n` +
      `- **Threats** in this model\n` +
      `- **Assets** and their security posture\n` +
      `- **Diagrams** and data flows\n` +
      `- A **summary** of the threat model`
    );
  }

  private countEntities(context: ChatContextPayload): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entity of context.entities) {
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    }
    return counts;
  }
}
