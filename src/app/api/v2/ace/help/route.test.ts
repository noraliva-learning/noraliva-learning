import { describe, expect, it } from 'vitest';
import { classifyIntent } from '@/lib/ace/intentRouter';

describe('ACE intent router', () => {
  describe('classifyIntent', () => {
    it('"my name is Elle" => self_intro (social only)', () => {
      expect(classifyIntent('my name is Elle')).toBe('self_intro');
      expect(classifyIntent('My name is Elle')).toBe('self_intro');
    });

    it('"I\'m confused" => confusion (guide only)', () => {
      expect(classifyIntent("I'm confused")).toBe('confusion');
      expect(classifyIntent('I am confused')).toBe('confusion');
    });

    it('"What do I do next?" => follow_up (guide only)', () => {
      expect(classifyIntent('What do I do next?')).toBe('follow_up');
      expect(classifyIntent('what do i do next')).toBe('follow_up');
    });

    it('"thank you Lila" => gratitude (social only)', () => {
      expect(classifyIntent('thank you Lila')).toBe('gratitude');
      expect(classifyIntent('thanks Dan')).toBe('gratitude');
    });

    it('"how old are you?" => meta_question (playful redirect only)', () => {
      expect(classifyIntent('how old are you?')).toBe('meta_question');
      expect(classifyIntent('How old are you?')).toBe('meta_question');
    });

    it('greeting => greeting', () => {
      expect(classifyIntent('hi')).toBe('greeting');
      expect(classifyIntent('Hello')).toBe('greeting');
    });

    it('help request => help_request', () => {
      expect(classifyIntent('can you help me?')).toBe('help_request');
      expect(classifyIntent('give me a hint')).toBe('help_request');
    });

    it('content question => content_question', () => {
      expect(classifyIntent('why is the answer 7?')).toBe('content_question');
      expect(classifyIntent('how do I solve this?')).toBe('content_question');
    });
  });
});
