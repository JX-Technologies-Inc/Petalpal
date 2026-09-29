import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  FlowerPlacementRecord,
  loadFlowerPlacements,
} from '@/components/garden/planting/plantingPersistence';
import { MONTH_REGION_METAS } from '@/components/garden/planting/plantingRegionData';
import { SAMPLE_ENTRIES, type JournalEntry } from '@/data/journalEntries';

const FLOWER_ASSETS: Record<string, any> = {
  pink: require('../../assets/garden/flowers/pink.png'),
  purple: require('../../assets/garden/flowers/purple.png'),
  blue: require('../../assets/garden/flowers/blue.png'),
  sunflower: require('../../assets/garden/flowers/sunflower.png'),
  tulip: require('../../assets/garden/flowers/tulip.png'),
};

export default function JournalScreen() {
  const [placements, setPlacements] = useState<FlowerPlacementRecord[]>([]);

  const refreshPlacements = useCallback(() => {
    loadFlowerPlacements().then(setPlacements);
  }, []);

  useEffect(() => {
    refreshPlacements();
  }, [refreshPlacements]);

  const getImage = (name?: string) => {
    if (!name) return FLOWER_ASSETS.pink;
    const lower = name.toLowerCase();
    if (lower.includes('sunflower')) return FLOWER_ASSETS.sunflower;
    if (lower.includes('tulip')) return FLOWER_ASSETS.tulip;
    if (lower.includes('purple')) return FLOWER_ASSETS.purple;
    if (lower.includes('blue')) return FLOWER_ASSETS.blue;
    return FLOWER_ASSETS.pink;
  };

  const handlePlantFlower = (entry: JournalEntry) => {
    router.push({
      pathname: '/garden-test',
      params: {
        mode: 'plant',
        flowerId: entry.flowerId,
        journalEntryId: entry.id,
        plantedDate: entry.date,
        month: entry.month.toString(),
        flowerName: entry.flowerName,
        speciesCode: entry.speciesCode,
        mood: entry.mood,
      },
    });
  };

  const handleAdjustPosition = (flowerId: string) => {
    router.push({
      pathname: '/garden-test',
      params: {
        mode: 'adjust',
        flowerId: flowerId,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/garden-test')}
          style={styles.gardenButton}
        >
          <Text style={styles.gardenButtonText}>🌸 Open Garden</Text>
        </Pressable>
        <Text style={styles.headerTitle}>PetalPal Journal</Text>
        <Text style={styles.headerSubtitle}>
          Daily reflections blossomed into living garden flowers
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {SAMPLE_ENTRIES.map((entry) => {
          const plantedFlower = placements.find(
            (p) => p.flowerId === entry.flowerId || p.id === entry.flowerId
          );
          const isPlanted = !!plantedFlower;
          const meta = MONTH_REGION_METAS[entry.month];
          const monthName = meta?.monthName || `Month ${entry.month}`;
          const formattedDate = new Date(entry.date).toLocaleDateString(
            undefined,
            { month: 'short', day: 'numeric', year: 'numeric' }
          );

          return (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.entryDate}>{formattedDate}</Text>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                </View>
                <View style={styles.moodPill}>
                  <Text style={styles.moodText}>{entry.mood}</Text>
                </View>
              </View>

              <Text style={styles.reflectionText}>{entry.reflection}</Text>

              {/* Flower Status Banner */}
              <View style={styles.flowerStatusRow}>
                <Image
                  source={getImage(entry.flowerName)}
                  style={styles.flowerThumb}
                  resizeMode="contain"
                />
                <View style={styles.flowerInfoCol}>
                  <Text style={styles.flowerSpeciesText}>
                    {entry.flowerName.toUpperCase()} BLOOM
                  </Text>
                  <Text style={styles.regionConstraintText}>
                    Assigned Region: {monthName} ({meta?.landId || 'Land'})
                  </Text>
                  {isPlanted ? (
                    <Text style={styles.plantedBadgeText}>
                      ✓ Planted at ({Math.round(plantedFlower.worldX)},{' '}
                      {Math.round(plantedFlower.worldY)}) • 💗 {plantedFlower.supportCount || 0}
                    </Text>
                  ) : (
                    <Text style={styles.unplantedBadgeText}>
                      ⏳ Ready to be planted
                    </Text>
                  )}
                </View>

                {/* Action button */}
                <View style={styles.actionCol}>
                  {isPlanted ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleAdjustPosition(entry.flowerId)}
                      style={({ pressed }) => [
                        styles.adjustButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.adjustButtonText}>🔄 Adjust</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handlePlantFlower(entry)}
                      style={({ pressed }) => [
                        styles.plantButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.plantButtonText}>🌱 Plant</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  gardenButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 8,
  },
  gardenButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  moodPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  reflectionText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 14,
  },
  flowerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  flowerThumb: {
    width: 44,
    height: 44,
  },
  flowerInfoCol: {
    flex: 1,
  },
  flowerSpeciesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  regionConstraintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  plantedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 3,
  },
  unplantedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 3,
  },
  actionCol: {
    justifyContent: 'center',
  },
  plantButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#16A34A',
  },
  plantButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adjustButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#245B45',
  },
  adjustButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
