/**
 * PetalPal Send Feedback Form
 *
 * Dedicated letter-writing experience matching the botanical stationery
 * aesthetic of the PetalPal garden world.
 *
 * Features:
 * - Category pill selectors (Bug, Feature, General, AI Concern, Other)
 * - Optional subject input
 * - Multiline message textarea (required, scrollable, multi-paragraph, multilingual)
 * - Optional screenshot attachment with thumbnail preview and removal
 * - Optional reply email with format validation
 * - Honest development mode feedback notice & transport integration
 * - Persistent draft state preservation
 */

import React, { memo, useCallback, useId, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FONT_BODY, FONT_DISPLAY, FONT_TITLE } from '../mailbox/ExpandedLetter';
import { useFeedbackDraft } from './FeedbackDraftContext';
import { getFeedbackTransport } from './feedbackService';
import {
  FEEDBACK_CATEGORIES,
  FeedbackCategory,
  SubmissionStatus,
} from './feedbackTypes';

interface SendFeedbackFormProps {
  onBack: () => void;
  onClose: () => void;
  currentRoute?: string;
}

export const SendFeedbackForm = memo(function SendFeedbackForm({
  onBack,
  onClose,
  currentRoute,
}: SendFeedbackFormProps) {
  const { draft, updateDraft, clearDraft, hasDraft } = useFeedbackDraft();
  const [submissionStatus, setSubmissionStatus] =
    useState<SubmissionStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const fileInputRef = useRef<any>(null);

  // Email validation regex (standard basic email format)
  const isValidEmail = (email: string) => {
    if (!email.trim()) return true; // Optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleCategorySelect = (category: FeedbackCategory) => {
    updateDraft({ category });
    setValidationError(null);
  };

  const handleSubjectChange = (text: string) => {
    updateDraft({ subject: text });
  };

  const handleMessageChange = (text: string) => {
    updateDraft({ message: text });
    if (validationError) setValidationError(null);
  };

  const handleEmailChange = (text: string) => {
    updateDraft({ email: text });
    if (validationError && isValidEmail(text)) {
      setValidationError(null);
    }
  };

  // Image Attachment Upload (Web File Input or simulated attachment)
  const handleAttachmentClick = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      // Mock attachment for testing on non-web
      const mockId = `img_${Date.now()}`;
      updateDraft({
        attachments: [
          ...draft.attachments,
          {
            id: mockId,
            name: `Screenshot_${draft.attachments.length + 1}.png`,
            uri: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23437568"/><circle cx="30" cy="30" r="14" fill="%23FAF6EE"/></svg>',
          },
        ],
      });
    }
  };

  const handleFileInputChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Image attachment must be smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const uri = event.target?.result as string;
      const newAttachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        uri,
        sizeBytes: file.size,
      };
      updateDraft({
        attachments: [...draft.attachments, newAttachment],
      });
    };
    reader.readAsDataURL(file);
    // Reset file input value
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    updateDraft({
      attachments: draft.attachments.filter((a) => a.id !== id),
    });
  };

  const handleDiscardDraft = () => {
    if (!showDiscardConfirm) {
      setShowDiscardConfirm(true);
      return;
    }
    clearDraft();
    setShowDiscardConfirm(false);
    setValidationError(null);
    setSubmissionNotice(null);
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (!draft.message || draft.message.trim().length === 0) {
      setValidationError('Please enter a message before sending.');
      return;
    }

    if (draft.email.trim() && !isValidEmail(draft.email)) {
      setValidationError('Please enter a valid email address or leave it blank.');
      return;
    }

    setValidationError(null);
    setSubmissionStatus('sending');

    try {
      const transport = getFeedbackTransport();
      const payload = {
        category: draft.category,
        subject: draft.subject.trim(),
        message: draft.message.trim(),
        email: draft.email.trim() || undefined,
        attachments: draft.attachments.map((a) => ({
          name: a.name,
          sizeBytes: a.sizeBytes,
        })),
        route: currentRoute || (typeof window !== 'undefined' ? window.location?.pathname : undefined),
        timestamp: Date.now(),
        clientVersion: '1.0.0-dev',
      };

      const result = await transport.submitFeedback(payload);

      if (result.isRealTransport) {
        // Real backend succeeded
        setSubmissionStatus('success');
        setSubmissionNotice(
          result.referenceId
            ? `Feedback received! Reference ID: #${result.referenceId}`
            : 'Thank you for helping our garden grow. Your feedback has been received.'
        );
        // Clear draft upon confirmed real submission
        clearDraft();
      } else {
        // Honest local dev transport notice:
        // Do NOT claim it went to the team; preserve user draft intact!
        setSubmissionStatus('idle');
        setSubmissionNotice(
          '🌱 Local Dev Mode: Feedback recorded locally on this device. Real support endpoint is not configured in this build. Your draft is preserved safely.'
        );
      }
    } catch (err: any) {
      setSubmissionStatus('error');
      setValidationError(
        err?.message || 'Something went wrong while recording feedback.'
      );
    }
  };

  const transport = getFeedbackTransport();
  const isMessageValid = draft.message.trim().length > 0;
  const isEmailValid = isValidEmail(draft.email);
  const canSubmit = isMessageValid && isEmailValid && submissionStatus !== 'sending';

  return (
    <View style={styles.container}>
      {/* Hidden File Input for Web Screenshots */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      )}

      {/* ── HEADER WITH BACK ARROW, TITLE, AND CLOSE ── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Help menu"
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed, hovered }: any) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
            hovered && styles.backButtonHovered,
          ]}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <View style={styles.headerTitleColumn}>
          <Text style={styles.headerTitle}>Send Feedback</Text>
          <Text style={styles.headerSubtitle}>
            Your thoughts help our garden grow.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed, hovered }: any) => [
            styles.closeButton,
            pressed && styles.closePressed,
            hovered && styles.closeHovered,
          ]}
        >
          <Text style={styles.closeIconGlyph}>✕</Text>
        </Pressable>
      </View>

      {/* ── SCROLLABLE FORM BODY ── */}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Development Transport Mode Notice (Honest Architecture) */}
        {!transport.isRealTransportConfigured && (
          <View style={styles.devModeNoticeBanner}>
            <Text style={styles.devModeNoticeText}>
              🌱 <Text style={{ fontWeight: '700' }}>Dev Preview:</Text> Offline
              draft mode · Real support endpoint not configured
            </Text>
          </View>
        )}

        {/* ── FIELD A: FEEDBACK TYPE CATEGORY SELECTOR ── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryPillsContainer}>
            {FEEDBACK_CATEGORIES.map((cat) => {
              const isSelected = draft.category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Category: ${cat.label}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleCategorySelect(cat.id)}
                  style={({ pressed, hovered }: any) => [
                    styles.categoryPill,
                    isSelected && styles.categoryPillActive,
                    pressed && styles.categoryPillPressed,
                    hovered && !isSelected && styles.categoryPillHovered,
                  ]}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      isSelected && styles.categoryLabelActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── FIELD B: SUBJECT (OPTIONAL) ── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Subject (optional)</Text>
          <TextInput
            accessibilityLabel="Feedback subject"
            value={draft.subject}
            onChangeText={handleSubjectChange}
            placeholder="What's on your mind?"
            placeholderTextColor="#9A8C9E"
            maxLength={120}
            style={styles.textInput}
          />
        </View>

        {/* ── FIELD C: MESSAGE (REQUIRED MULTILINE) ── */}
        <View style={styles.fieldSection}>
          <View style={styles.labelWithCounterRow}>
            <Text style={styles.fieldLabel}>
              Message <Text style={styles.requiredStar}>*</Text>
            </Text>
            {draft.message.length > 0 && (
              <Text style={styles.charCountText}>
                {draft.message.length} chars
              </Text>
            )}
          </View>
          <TextInput
            accessibilityLabel="Feedback message"
            value={draft.message}
            onChangeText={handleMessageChange}
            placeholder="Tell us what happened, what you'd love to see, or anything you'd like us to know..."
            placeholderTextColor="#9A8C9E"
            multiline={true}
            numberOfLines={5}
            textAlignVertical="top"
            style={styles.textAreaInput}
          />
        </View>

        {/* ── FIELD D: SCREENSHOT ATTACHMENTS (OPTIONAL) ── */}
        <View style={styles.fieldSection}>
          <View style={styles.attachmentHeaderRow}>
            <Text style={styles.fieldLabel}>Screenshot (optional)</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach screenshot"
              onPress={handleAttachmentClick}
              style={({ pressed, hovered }: any) => [
                styles.attachButton,
                pressed && styles.attachButtonPressed,
                hovered && styles.attachButtonHovered,
              ]}
            >
              <Text style={styles.attachButtonIcon}>📎</Text>
              <Text style={styles.attachButtonText}>
                {draft.attachments.length > 0
                  ? 'Add another'
                  : 'Attach image'}
              </Text>
            </Pressable>
          </View>

          {/* Attached Thumbnails List */}
          {draft.attachments.length > 0 && (
            <View style={styles.attachmentsList}>
              {draft.attachments.map((att) => (
                <View key={att.id} style={styles.thumbnailWrapper}>
                  <Image
                    source={{ uri: att.uri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove attachment ${att.name}`}
                    onPress={() => handleRemoveAttachment(att.id)}
                    style={styles.removeThumbnailButton}
                  >
                    <Text style={styles.removeThumbnailGlyph}>✕</Text>
                  </Pressable>
                  <Text
                    style={styles.thumbnailName}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {att.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── FIELD E: REPLY EMAIL (OPTIONAL) ── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Your email (optional)</Text>
          <TextInput
            accessibilityLabel="Reply email"
            value={draft.email}
            onChangeText={handleEmailChange}
            placeholder="your.email@example.com (optional)"
            placeholderTextColor="#9A8C9E"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />
          <Text style={styles.fieldHelperText}>
            Only used if you'd like our garden team to follow up.
          </Text>
        </View>

        {/* ── VALIDATION & STATUS NOTICES ── */}
        {validationError && (
          <View style={styles.validationNoticeBox}>
            <Text style={styles.validationNoticeText}>⚠️ {validationError}</Text>
          </View>
        )}

        {submissionNotice && (
          <View style={styles.submissionNoticeBox}>
            <Text style={styles.submissionNoticeText}>{submissionNotice}</Text>
          </View>
        )}

        {/* ── BOTTOM ACTIONS: SUBMIT & DISCARD DRAFT ── */}
        <View style={styles.actionsSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send Feedback"
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed, hovered }: any) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.submitButtonPressed,
              hovered && canSubmit && styles.submitButtonHovered,
            ]}
          >
            {submissionStatus === 'sending' ? (
              <View style={styles.sendingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Sending...</Text>
              </View>
            ) : (
              <View style={styles.sendingRow}>
                <Text style={styles.submitButtonIcon}>✿</Text>
                <Text style={styles.submitButtonText}>Send Feedback</Text>
              </View>
            )}
          </Pressable>

          {/* Explicit Discard Draft Action */}
          {hasDraft && (
            <View style={styles.discardRow}>
              {showDiscardConfirm ? (
                <View style={styles.discardConfirmBox}>
                  <Text style={styles.discardConfirmText}>
                    Discard this draft?
                  </Text>
                  <View style={styles.discardConfirmButtons}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleDiscardDraft}
                      style={styles.discardConfirmYesBtn}
                    >
                      <Text style={styles.discardConfirmYesText}>Yes, discard</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowDiscardConfirm(false)}
                      style={styles.discardConfirmNoBtn}
                    >
                      <Text style={styles.discardConfirmNoText}>Keep draft</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Discard draft"
                  onPress={() => setShowDiscardConfirm(true)}
                  style={styles.discardDraftButton}
                >
                  <Text style={styles.discardDraftText}>Discard draft</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 4,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(182, 156, 186, 0.25)',
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(182, 156, 186, 0.12)',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonHovered: {
    backgroundColor: 'rgba(182, 156, 186, 0.22)',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_BODY,
    color: '#4A3B52',
  },
  headerTitleColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONT_TITLE,
    color: '#2D2034',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    fontStyle: 'italic',
    color: '#6E5C74',
    marginTop: 2,
    textAlign: 'center',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(182, 156, 186, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  closePressed: {
    opacity: 0.7,
  },
  closeHovered: {
    backgroundColor: 'rgba(182, 156, 186, 0.28)',
  },
  closeIconGlyph: {
    fontSize: 12,
    color: '#4F3B54',
    lineHeight: 14,
  },

  /* ── Form Scroll Body ── */
  formScroll: {
    flex: 1,
    maxHeight: 580,
  },
  formScrollContent: {
    paddingVertical: 6,
    paddingBottom: 28,
    gap: 12,
  },

  /* ── Dev Mode Banner ── */
  devModeNoticeBanner: {
    backgroundColor: 'rgba(67, 117, 104, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(67, 117, 104, 0.22)',
  },
  devModeNoticeText: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: '#2E584D',
    lineHeight: 14.5,
  },

  /* ── Field Sections ── */
  fieldSection: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_TITLE,
    color: '#3B2D40',
    letterSpacing: 0.1,
  },
  requiredStar: {
    color: '#B84545',
    fontWeight: '700',
  },
  labelWithCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCountText: {
    fontSize: 10.5,
    fontFamily: FONT_BODY,
    color: '#8A7A8E',
  },
  fieldHelperText: {
    fontSize: 10.5,
    fontFamily: FONT_BODY,
    color: '#7D6D82',
    marginTop: 2,
  },

  /* ── Category Pills ── */
  categoryPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EFE4',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(160, 130, 165, 0.35)',
    gap: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.18s ease',
      } as any,
    }),
  },
  categoryPillActive: {
    backgroundColor: '#3E685B',
    borderColor: '#2D4E44',
  },
  categoryPillPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  categoryPillHovered: {
    backgroundColor: '#EBE2D4',
  },
  categoryIcon: {
    fontSize: 12,
  },
  categoryLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: FONT_BODY,
    color: '#4C3B52',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* ── Text Inputs ── */
  textInput: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: 'rgba(182, 156, 186, 0.40)',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    color: '#2D2034',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  textAreaInput: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: 'rgba(182, 156, 186, 0.40)',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: FONT_BODY,
    color: '#2D2034',
    minHeight: 110,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        resize: 'vertical',
      } as any,
    }),
  },

  /* ── Attachments ── */
  attachmentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(182, 156, 186, 0.12)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  attachButtonPressed: {
    opacity: 0.7,
  },
  attachButtonHovered: {
    backgroundColor: 'rgba(182, 156, 186, 0.22)',
  },
  attachButtonIcon: {
    fontSize: 11,
  },
  attachButtonText: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    fontWeight: '600',
    color: '#4B3C52',
  },
  attachmentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  thumbnailWrapper: {
    width: 62,
    alignItems: 'center',
    position: 'relative',
  },
  thumbnailImage: {
    width: 54,
    height: 54,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(182, 156, 186, 0.45)',
    backgroundColor: '#EAE3D8',
  },
  removeThumbnailButton: {
    position: 'absolute',
    top: -4,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#322336',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  removeThumbnailGlyph: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  thumbnailName: {
    fontSize: 9.5,
    fontFamily: FONT_BODY,
    color: '#6E5C74',
    marginTop: 2,
    textAlign: 'center',
    width: 58,
  },

  /* ── Status Notices ── */
  validationNoticeBox: {
    backgroundColor: 'rgba(184, 69, 69, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(184, 69, 69, 0.28)',
  },
  validationNoticeText: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: '#A23535',
    lineHeight: 15,
  },
  submissionNoticeBox: {
    backgroundColor: 'rgba(67, 117, 104, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 117, 104, 0.35)',
  },
  submissionNoticeText: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: '#284F44',
    lineHeight: 15.5,
  },

  /* ── Actions ── */
  actionsSection: {
    marginTop: 6,
    gap: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#437568',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(67, 117, 104, 0.30)',
        transition: 'all 0.18s ease',
      } as any,
    }),
  },
  submitButtonDisabled: {
    backgroundColor: '#9FB5AD',
    opacity: 0.65,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
        boxShadow: 'none',
      } as any,
    }),
  },
  submitButtonPressed: {
    backgroundColor: '#365E53',
    transform: [{ scale: 0.985 }],
  },
  submitButtonHovered: {
    backgroundColor: '#3B685C',
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitButtonIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_TITLE,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* Discard Draft */
  discardRow: {
    alignItems: 'center',
    marginTop: 2,
  },
  discardDraftButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  discardDraftText: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: '#8D7B91',
    textDecorationLine: 'underline',
  },
  discardConfirmBox: {
    backgroundColor: '#F3ECE1',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(182, 156, 186, 0.40)',
    width: '100%',
  },
  discardConfirmText: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: '#46364A',
    fontWeight: '600',
  },
  discardConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  discardConfirmYesBtn: {
    backgroundColor: '#B84545',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  discardConfirmYesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  discardConfirmNoBtn: {
    backgroundColor: 'rgba(182, 156, 186, 0.20)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  discardConfirmNoText: {
    color: '#3E2E42',
    fontSize: 11,
    fontWeight: '600',
  },
});
