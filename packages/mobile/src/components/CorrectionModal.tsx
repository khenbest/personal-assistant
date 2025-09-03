/**
 * Correction Modal Component
 * Allows users to correct misrecognized intents and slots
 * Provides immediate learning feedback
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CorrectionData {
  predictionId?: string;
  originalText: string;
  predictedIntent: string;
  predictedSlots: Record<string, any>;
  confidence: number;
  event?: {
    title: string;
    start_time: string;
    end_time: string;
  };
}

interface CorrectionModalProps {
  visible: boolean;
  data: CorrectionData | null;
  onClose: () => void;
  onConfirm: (corrected: CorrectionData, alwaysDoThis: boolean) => Promise<void>;
}

const INTENT_OPTIONS = [
  { value: 'create_event', label: 'Create Calendar Event' },
  { value: 'add_reminder', label: 'Add Reminder' },
  { value: 'create_note', label: 'Create Note' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'read_email', label: 'Read Email' },
  { value: 'none', label: 'None (Unrecognized)' },
];

export function CorrectionModal({ visible, data, onClose, onConfirm }: CorrectionModalProps) {
  const [correctedIntent, setCorrectedIntent] = useState(data?.predictedIntent || '');
  const [correctedTitle, setCorrectedTitle] = useState(data?.event?.title || '');
  const [alwaysDoThis, setAlwaysDoThis] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntentPicker, setShowIntentPicker] = useState(false);

  // Update state when data changes
  React.useEffect(() => {
    if (data) {
      setCorrectedIntent(data.predictedIntent);
      setCorrectedTitle(data.event?.title || data.predictedSlots?.title || '');
      setAlwaysDoThis(false);
    }
  }, [data]);

  const handleSubmit = async () => {
    if (!data) return;

    setIsSubmitting(true);
    try {
      const correctedData: CorrectionData = {
        ...data,
        predictedIntent: correctedIntent,
        predictedSlots: {
          ...data.predictedSlots,
          title: correctedTitle,
        },
      };

      await onConfirm(correctedData, alwaysDoThis);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to apply correction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.91) return '#34C759'; // Green
    if (confidence >= 0.81) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.91) return 'High Confidence';
    if (confidence >= 0.81) return 'Medium Confidence';
    return 'Low Confidence';
  };

  if (!data) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Review & Correct</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Original Text */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What you said:</Text>
              <Text style={styles.originalText}>"{data.originalText}"</Text>
            </View>

            {/* Confidence Indicator */}
            <View style={styles.section}>
              <View style={styles.confidenceContainer}>
                <Text style={styles.sectionTitle}>Recognition Confidence:</Text>
                <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(data.confidence) }]}>
                  <Text style={styles.confidenceText}>
                    {(data.confidence * 100).toFixed(0)}% - {getConfidenceText(data.confidence)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Intent Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Intent:</Text>
              <TouchableOpacity 
                style={styles.intentSelector}
                onPress={() => setShowIntentPicker(!showIntentPicker)}
              >
                <Text style={styles.intentText}>
                  {INTENT_OPTIONS.find(o => o.value === correctedIntent)?.label || correctedIntent}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              
              {showIntentPicker && (
                <View style={styles.intentOptions}>
                  {INTENT_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.intentOption,
                        correctedIntent === option.value && styles.intentOptionSelected
                      ]}
                      onPress={() => {
                        setCorrectedIntent(option.value);
                        setShowIntentPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.intentOptionText,
                        correctedIntent === option.value && styles.intentOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Event Details (if calendar event) */}
            {correctedIntent === 'create_event' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Event Details:</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Title:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={correctedTitle}
                    onChangeText={setCorrectedTitle}
                    placeholder="Enter event title"
                  />
                </View>
                {data.event && (
                  <>
                    <View style={styles.eventDetail}>
                      <Ionicons name="calendar" size={16} color="#666" />
                      <Text style={styles.eventDetailText}>
                        {new Date(data.event.start_time).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.eventDetail}>
                      <Ionicons name="time" size={16} color="#666" />
                      <Text style={styles.eventDetailText}>
                        Duration: {Math.round((new Date(data.event.end_time).getTime() - 
                                              new Date(data.event.start_time).getTime()) / 60000)} minutes
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Always Do This Option */}
            <View style={styles.section}>
              <View style={styles.alwaysContainer}>
                <View style={styles.alwaysTextContainer}>
                  <Text style={styles.alwaysTitle}>Always do this</Text>
                  <Text style={styles.alwaysDescription}>
                    Apply this correction for similar future commands
                  </Text>
                </View>
                <Switch
                  value={alwaysDoThis}
                  onValueChange={setAlwaysDoThis}
                  trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {data.confidence >= 0.91 ? 'Confirm' : 'Apply Correction'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34, // Account for home indicator
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  originalText: {
    fontSize: 16,
    color: '#000000',
    fontStyle: 'italic',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  confidenceContainer: {
    flexDirection: 'column',
  },
  confidenceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  intentSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  intentText: {
    fontSize: 16,
    color: '#000000',
  },
  intentOptions: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  intentOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  intentOptionSelected: {
    backgroundColor: '#007AFF',
  },
  intentOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  intentOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#000000',
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  alwaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 8,
  },
  alwaysTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  alwaysTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  alwaysDescription: {
    fontSize: 14,
    color: '#666666',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});