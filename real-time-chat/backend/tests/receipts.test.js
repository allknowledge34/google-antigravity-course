import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { updateReceipt } from '../src/services/conversation.service.js';
import { ConversationMember } from '../src/models/conversationMember.model.js';
import { Conversation } from '../src/models/conversation.model.js';
import { User } from '../src/models/user.model.js';

describe('Receipts API', () => {
  let userA, userB, userC, conversation;

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMember.deleteMany({});

    userA = await User.create({ clerkId: 'receiptA', username: 'usera', displayName: 'User A' });
    userB = await User.create({ clerkId: 'receiptB', username: 'userb', displayName: 'User B' });
    userC = await User.create({ clerkId: 'receiptC', username: 'userc', displayName: 'User C' });

    conversation = await Conversation.create({ type: 'group', createdBy: userA._id });
    
    await ConversationMember.create([
      { conversationId: conversation._id, userId: userA._id, role: 'owner' },
      { conversationId: conversation._id, userId: userB._id, role: 'member' }
    ]);
  });

  it('unauthorized user cannot acknowledge delivery', async () => {
    const msgId = new mongoose.Types.ObjectId();
    await expect(updateReceipt(userC._id.toString(), conversation._id.toString(), msgId.toString(), 'delivered'))
      .rejects.toThrow('Forbidden');
  });

  it('updateReceipt changes state to delivered', async () => {
    const msgId = new mongoose.Types.ObjectId();
    await updateReceipt(userB._id.toString(), conversation._id.toString(), msgId.toString(), 'delivered');
    
    const member = await ConversationMember.findOne({ userId: userB._id, conversationId: conversation._id });
    expect(member.lastDeliveredMessageId.toString()).toBe(msgId.toString());
  });

  it('updateReceipt read also updates delivered implicitly', async () => {
    const msgId = new mongoose.Types.ObjectId();
    await updateReceipt(userB._id.toString(), conversation._id.toString(), msgId.toString(), 'read');
    
    const member = await ConversationMember.findOne({ userId: userB._id, conversationId: conversation._id });
    expect(member.lastReadMessageId.toString()).toBe(msgId.toString());
    expect(member.lastDeliveredMessageId.toString()).toBe(msgId.toString());
  });

  it('older message receipts do not overwrite newer ones', async () => {
    const newMsgId = new mongoose.Types.ObjectId();
    await updateReceipt(userB._id.toString(), conversation._id.toString(), newMsgId.toString(), 'read');
    
    const oldMsgId = new mongoose.Types.ObjectId(Math.floor(Date.now() / 1000) - 10000); 
    await updateReceipt(userB._id.toString(), conversation._id.toString(), oldMsgId.toString(), 'read');
    
    const member = await ConversationMember.findOne({ userId: userB._id, conversationId: conversation._id });
    expect(member.lastReadMessageId.toString()).toBe(newMsgId.toString());
  });
});
