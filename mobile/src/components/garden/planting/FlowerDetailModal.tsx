import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePlanting } from './PlantingContext';
import { MONTH_REGION_METAS } from './plantingRegionData';

const FLOWER_ASSETS: Record<string, any> = {
  pink: require('../../../../assets/garden/flowers/pink.png'),
  purple: require('../../../../assets/garden/flowers/purple.png'),
  blue: require('../../../../assets/garden/flowers/blue.png'),
  sunflower: require('../../../../assets/garden/flowers/sunflower.png'),
  tulip: require('../../../../assets/garden/flowers/tulip.png'),
};

export default function FlowerDetailModal() {
  const {
    selectedFlower,
    closeFlowerDetail,
    startAdjusting,
    supportFlower,
  } = usePlanting();

  if (!selectedFlower) return null;

  const meta = MONTH_REGION_METAS[selectedFlower.month];
  const monthName = meta?.monthName || `Month ${selectedFlower.month}`;

  const getImage = (name?: string) => {
    if (!name) return FLOWER_ASSETS.pink;
    const lower = name.toLowerCase();
    if (lower.includes('sunflower')) return FLOWER_ASSETS.sunflower;
    if (lower.includes('tulip')) return FLOWER_ASSETS.tulip;
    if (lower.includes('purple')) return FLOWER_ASSETS.purple;
    if (lower.includes('blue')) return FLOWER_ASSETS.blue;
    return FLOWER_ASSETS.pink;
  };

  const flowerImg = getImage(selectedFlower.flowerName);

  const formattedDate = new Date(selectedFlower.plantedDate).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric', year: 'numeric' }
  );

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!selectedFlower}
      onRequestClose={closeFlowerDetail}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.backdropPressable} onPress={closeFlowerDetail} />

        <View style={styles.modalCard}>
          {/* Close button */}
          <Pressable
            accessibilityRole="button"
            onPress={closeFlowerDetail}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>

          {/* Flower Visual Header */}
          <View style={styles.imageWrapper}>
            <Image
              source={flowerImg}
              style={styles.flowerImage}
              resizeMode="contain"
            />
          </View>

          {/* Details */}
          <Text style={styles.flowerName}>
            {selectedFlower.flowerName ? selectedFlower.flowerName.toUpperCase() : 'Garden Bloom'}
          </Text>
          <Text style={styles.locationSubtitle}>
            {monthName} Garden • {meta?.landId || 'Garden'}
          </Text>

          {selectedFlower.mood && (
            <View style={styles.tagRow}>
              <View style={styles.moodTag}>
                <Text style={styles.moodTagText}>Mood: {selectedFlower.mood}</Text>
              </View>
              <View style={styles.dateTag}>
                <Text style={styles.dateTagText}>Planted: {formattedDate}</Text>
              </View>
            </View>
          )}

          {selectedFlower.notes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>"{selectedFlower.notes}"</Text>
            </View>
          ) : null}

          {/* Action Row: Support & Adjust Position */}
          <View style={styles.actionRow}>
            {/* Give Support Button (Preserving Existing Production Support Feature) */}
            <Pressable
              accessibilityRole="button"
              onPress={() => supportFlower(selectedFlower.flowerId)}
              style={({ pressed }) => [
                styles.supportButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.supportButtonText}>
                💗 Support ({selectedFlower.supportCount || 0})
              </Text>
            </Pressable>

            {/* Adjust Position Button */}
            <Pressable
              accessibilityRole="button"
              onPress={() => startAdjusting(selectedFlower)}
              style={({ pressed }) => [
                styles.adjustButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.adjustButtonText}>🔄 Adjust Position</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  imageWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 60,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  flowerImage: {
    width: 90,
    height: 90,
  },
  flowerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  moodTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moodTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  dateTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dateTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    width: '100%',
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 18,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  supportButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  supportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BE185D',
  },
  adjustButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#245B45',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
