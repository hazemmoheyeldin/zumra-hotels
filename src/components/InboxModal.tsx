import React, { useState } from 'react';
import { User, Message } from '../types';
import { useLang } from '../lib/LanguageContext';

interface InboxModalProps {
  currentUser: User;
  users: User[];
  messages: Message[];
  onSaveMessages: (messages: Message[]) => void;
  onClose: () => void;
}

export default function InboxModal({ currentUser, users, messages, onSaveMessages, onClose }: InboxModalProps) {
  const { t } = useLang();
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const chatUsers = users.filter(u => u.id !== currentUser.id);

  const activeMessages = messages.filter(
    (m) =>
      (m.senderId === currentUser.id && m.receiverId === activeChatUser?.id) ||
      (m.senderId === activeChatUser?.id && m.receiverId === currentUser.id)
  );

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeChatUser) return;
    const msg: Message = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      receiverId: activeChatUser.id,
      content: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };
    const updated = [...messages, msg];
    onSaveMessages(updated);
    setNewMessage('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Users List Sidebar */}
        <div className="w-1/3 bg-slate-50 border-r border-slate-150 flex flex-col">
          <div className="p-4 border-b border-slate-150 bg-white flex justify-between items-center">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <span>💬</span> {t('inbox.title')}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {chatUsers.map(u => {
              const unread = messages.filter(m => m.receiverId === currentUser.id && m.senderId === u.id && !m.read).length;
              return (
                <div 
                  key={u.id}
                  onClick={() => {
                    setActiveChatUser(u);
                    // Mark as read
                    const updated = messages.map(m => (m.receiverId === currentUser.id && m.senderId === u.id ? { ...m, read: true } : m));
                    onSaveMessages(updated);
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition mb-1 flex justify-between items-center ${activeChatUser?.id === u.id ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-200 text-slate-700'}`}
                >
                  <div>
                    <div className="font-bold text-sm">{u.name}</div>
                    <div className="text-[10px] uppercase font-mono opacity-60 mt-0.5">{u.role}</div>
                  </div>
                  {unread > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unread}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          {activeChatUser ? (
            <>
              <div className="p-4 border-b border-slate-150 bg-white/80 backdrop-blur">
                <h3 className="font-bold text-slate-800">{activeChatUser.name} <span className="text-xs text-slate-400 font-normal ml-2">@{activeChatUser.username}</span></h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeMessages.length > 0 ? activeMessages.map(m => {
                  const isMe = m.senderId === currentUser.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                        {m.content}
                        <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">{t('inbox.noMessages')}</div>
                )}
              </div>
              <div className="p-4 bg-white border-t border-slate-150 flex gap-2">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={t('inbox.typeMessage')}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-400"
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition"
                >
                  {t('inbox.send')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 flex-col">
              <span className="text-4xl mb-2 grayscale opacity-50">✉️</span>
              <p className="font-semibold text-sm">{t('inbox.selectColleague')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
