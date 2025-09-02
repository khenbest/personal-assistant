/**
 * Correction UI Component
 * Allows users to correct intent classification and slots
 * Integrates with existing ChatScreen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IntentResult {
  intent: string;
  confidence: number;
  slots: Record<string, any>;
  needsConfirmation?: boolean;
}

interface CorrectionUIProps {
  originalText: string;
  prediction: IntentResult;
  onCorrection: (correctedIntent: string, correctedSlots: Record<string, any>) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}

const INTENT_LABELS = {
  create_event: '📅 Create Event',
  add_reminder: '⏰ Set Reminder',
  create_note: '📝 Create Note',
  read_email: '📧 Read Email',
  send_email: '✉️ Send Email',
  none: '❓ Other',
};

const INTENT_OPTIONS = Object.keys(INTENT_LABELS);

export function CorrectionUI({
  originalText,
  prediction,
  onCorrection,
  onConfirm,
  onCancel,
}: CorrectionUIProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState(prediction.intent);
  const [editedSlots, setEditedSlots] = useState(prediction.slots);
  const [alwaysCorrect, setAlwaysCorrect] = useState(false);

  const handleIntentChange = (newIntent: string) => {
    setSelectedIntent(newIntent);
    // Auto-adjust slots based on intent
    if (newIntent !== prediction.intent) {
      setEditedSlots(getDefaultSlotsForIntent(newIntent, originalText));
    }
  };

  const handleSlotEdit = (slotName: string, value: any) => {
    setEditedSlots(prev => ({
      ...prev,
      [slotName]: value,
    }));
  };

  const handleCorrection = () => {
    onCorrection(selectedIntent, editedSlots);
    setShowModal(false);
  };

  const handleQuickCorrection = (intent: string) => {
    onCorrection(intent, getDefaultSlotsForIntent(intent, originalText));
  };

  // Show confidence indicator
  const confidenceColor = prediction.confidence > 0.8 ? '#4CAF50' : 
                          prediction.confidence > 0.6 ? '#FFC107' : '#F44336';

  return (
    <View style={styles.container}>
      {/* Main Confirmation UI */}
      <View style={styles.confirmationCard}>
        <View style={styles.header}>
          <Text style={styles.intentLabel}>
            {INTENT_LABELS[prediction.intent as keyof typeof INTENT_LABELS]}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
            <Text style={styles.confidenceText}>
              {Math.round(prediction.confidence * 100)}%
            </Text>
          </View>
        </View>

        {/* Show key slots */}
        {Object.keys(prediction.slots).length > 0 && (
          <View style={styles.slotsPreview}>
            {Object.entries(prediction.slots).slice(0, 3).map(([key, value]) => (
              <Text key={key} style={styles.slotText}>
                {formatSlotName(key)}: {formatSlotValue(value)}
              </Text>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={onConfirm}
          >
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.buttonText}>Correct</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="pencil" size={20} color="#007AFF" />
            <Text style={[styles.buttonText, { color: '#007AFF' }]}>Edit</Text>
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Correction Options (if low confidence) */}
        {prediction.confidence < 0.7 && (
          <View style={styles.quickCorrections}>
            <Text style={styles.quickLabel}>Did you mean:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {INTENT_OPTIONS.filter(i => i !== prediction.intent).slice(0, 3).map(intent => (
                <TouchableOpacity
                  key={intent}
                  style={styles.quickOption}
                  onPress={() => handleQuickCorrection(intent)}
                >
                  <Text style={styles.quickOptionText}>
                    {INTENT_LABELS[intent as keyof typeof INTENT_LABELS]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Detailed Correction Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Correct Classification</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Original Text */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Your Request:</Text>
                <Text style={styles.originalText}>"{originalText}"</Text>
              </View>

              {/* Intent Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>What did you want to do?</Text>
                {INTENT_OPTIONS.map(intent => (
                  <TouchableOpacity
                    key={intent}
                    style={[
                      styles.intentOption,
                      selectedIntent === intent && styles.intentOptionSelected,
                    ]}
                    onPress={() => handleIntentChange(intent)}
                  >
                    <Text
                      style={[
                        styles.intentOptionText,
                        selectedIntent === intent && styles.intentOptionTextSelected,
                      ]}
                    >
                      {INTENT_LABELS[intent as keyof typeof INTENT_LABELS]}
                    </Text>
                    {selectedIntent === intent && (
                      <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Slot Editing */}
              {Object.keys(editedSlots).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Details:</Text>
                  {Object.entries(editedSlots).map(([key, value]) => (
                    <View key={key} style={styles.slotEditor}>
                      <Text style={styles.slotLabel}>{formatSlotName(key)}:</Text>
                      <TextInput
                        style={styles.slotInput}
                        value={String(value)}
                        onChangeText={(text) => handleSlotEdit(key, text)}
                        placeholder={`Enter ${formatSlotName(key)}`}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Learning Preference */}
              <View style={styles.section}>
                <View style={styles.learningOption}>
                  <Text style={styles.learningLabel}>
                    Always interpret similar requests this way
                  </Text>
                  <Switch
                    value={alwaysCorrect}
                    onValueChange={setAlwaysCorrect}
                    trackColor={{ false: '#767577', true: '#007AFF' }}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleCorrection}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>
                  Save Correction
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper Functions
function formatSlotName(slot: string): string {
  return slot
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatSlotValue(value: any): string {
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getDefaultSlotsForIntent(intent: string, text: string): Record<string, any> {
  // Basic slot extraction based on intent
  const slots: Record<string, any> = {};
  
  switch (intent) {
    case 'create_event':
      slots.title = '';
      slots.datetime_point = '';
      slots.duration_min = 60;
      break;
    case 'add_reminder':
      slots.reminder_text = text.replace(/^(remind|ping|alert)\s+me\s+(to\s+)?/i, '');
      slots.datetime_point = '';
      break;
    case 'create_note':
      slots.note_body = text.replace(/^(make a |create a )?(note|jot down):?\s*/i, '');
      break;
    case 'send_email':
      slots.email_to = '';
      slots.email_subject = '';
      slots.email_body = '';
      break;
    case 'read_email':
      slots.email_from = '';
      slots.time_range = 'today';
      break;
  }
  
  return slots;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  confirmationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  intentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  slotsPreview: {
    marginBottom: 12,
  },
  slotText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  editButton: {
    backgroundColor: '#F5F5F5',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  quickCorrections: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  quickLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  quickOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginRight: 8,
  },
  quickOptionText: {
    fontSize: 12,
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  originalText: {
    fontSize: 16,
    color: '#333',
    fontStyle: 'italic',
  },
  intentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  intentOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  intentOptionText: {
    fontSize: 16,
    color: '#333',
  },
  intentOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  slotEditor: {
    marginBottom: 12,
  },
  slotLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  slotInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  learningOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  learningLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default CorrectionUI;