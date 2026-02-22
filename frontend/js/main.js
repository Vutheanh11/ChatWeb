/* ============================================================
   main.js — Entry point
   Detects page (auth / chat), bootstraps the right module,
   and exposes every onclick-referenced function on window.
   ============================================================ */

import { initAuthPage, switchTab, login, register, showVerifyScreen, checkVerified,
         resendVerification, backToLogin, googleSignIn, forgotPassword,
         authToggleDark, togglePassword } from './auth.js';

import { initChatPage,
         // message menu
         showMsgMenu, hideMsgMenu, setReplyTo, clearReplyTo,
         recallMessage, deleteMsg,
         // select mode
         enterSelectMode, exitSelectMode, toggleMsgSelect, rerenderSelectBar, deleteSelectedMsgs,
         // block
         blockUser, updateBlockBtn,
         // send / keyboard
         sendMessage, handleMsgKey,
         // voice
         startVoiceRecording, stopAndSendVoice, cancelVoiceRecording,
         // gif
         toggleGifPicker, closeGifPicker, onGifSearchInput, sendGif,
         // typing
         onTyping,
         // sidebar / search
         filterContacts, filterTab, filterModal,
         // emoji
         toggleEmojiPicker,
         // misc
         clearChat, toggleChatSearch, searchMessages, toggleDropdown,
         // new-chat modal
         openNewChat, closeNewChat,
         // profile panel
         closeProfilePanel,
         // settings
         openSettings, closeSettings, toggleDark,
         // navigation
         closeMobileChat, logout,
         // add-friend
         openAddFriend, closeAddFriend, switchAFTab, viewRequests,
         searchFriends, clearFriendSearch,
         sendFriendRequest, messageExisting,
         acceptRequest, declineRequest,
         // my profile
         openMyProfile, closeMyProfile,
         // conversation
         openConversation,
       } from './chat.js';

import { startVoiceCall, startVideoCall, answerVoiceCall, declineVoiceCall,
         endVoiceCall, toggleCallMute, toggleVideoCamera } from './calls.js';

import { applyChatTheme, setChatTheme } from './utils.js';

// ── Page detection ────────────────────────────────────────────
const IS_AUTH = !!document.getElementById('form-login');
const IS_CHAT = !!document.getElementById('contact-list');

if (IS_AUTH) initAuthPage();
if (IS_CHAT) initChatPage();

// ── Expose everything that HTML onclick/onXxx attributes call ─
Object.assign(window, {
  // ── Auth Page ──
  switchTab, login, register, showVerifyScreen, checkVerified,
  resendVerification, backToLogin, googleSignIn, forgotPassword,
  authToggleDark, togglePassword,

  // ── Chat: message menu & actions ──
  showMsgMenu, hideMsgMenu, setReplyTo, clearReplyTo,
  recallMessage, deleteMsg,

  // ── Chat: select mode ──
  enterSelectMode, exitSelectMode, toggleMsgSelect, rerenderSelectBar, deleteSelectedMsgs,

  // ── Chat: block ──
  blockUser, updateBlockBtn,

  // ── Chat: send ──
  sendMessage, handleMsgKey,

  // ── Chat: voice messages ──
  startVoiceRecording, stopAndSendVoice, cancelVoiceRecording,

  // ── Chat: GIF ──
  toggleGifPicker, closeGifPicker, onGifSearchInput, sendGif,

  // ── Chat: typing ──
  onTyping,

  // ── Chat: sidebar / search / filter ──
  filterContacts, filterTab, filterModal,

  // ── Chat: emoji ──
  toggleEmojiPicker,

  // ── Chat: misc ──
  clearChat, toggleChatSearch, searchMessages, toggleDropdown,

  // ── Chat: new-chat modal ──
  openNewChat, closeNewChat,

  // ── Chat: profile panel ──
  closeProfilePanel,

  // ── Chat: settings ──
  openSettings, closeSettings, toggleDark,

  // ── Chat: navigation ──
  closeMobileChat, logout,

  // ── Chat: add-friend ──
  openAddFriend, closeAddFriend, switchAFTab, viewRequests,
  searchFriends, clearFriendSearch,
  sendFriendRequest, messageExisting,
  acceptRequest, declineRequest,

  // ── Chat: my profile ──
  openMyProfile, closeMyProfile,

  // ── Chat: open conversation ──
  openConversation,

  // ── Calls ──
  startVoiceCall, startVideoCall, answerVoiceCall, declineVoiceCall,
  endVoiceCall, toggleCallMute, toggleVideoCamera,

  // ── Theme ──
  applyChatTheme, setChatTheme,
});
