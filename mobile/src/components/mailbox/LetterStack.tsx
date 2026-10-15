import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LetterSummaryCard } from './LetterSummaryCard';
import type { Letter } from './types';

interface LetterStackProps {
  letters: Letter[];
  selectedLetterId: string | null;
  onSelectLetter: (letterId: string) => void;
  fanSpread?: number; // 0..1 (default 1.0)
  cardWidth?: number;
  isAllCollapsedMode?: boolean;
}

export const LetterStack = memo(function LetterStack({
  letters,
  selectedLetterId,
  onSelectLetter,
  fanSpread = 1.0,
  cardWidth = 220,
  isAllCollapsedMode = false,
}: LetterStackProps) {
  // If a letter is open, filter it out from the collapsed side-stack;
  // If in all-collapsed mode, show all letters in the stack.
  const stackCards = useMemo(() => {
    if (isAllCollapsedMode) return letters;
    return letters.filter((l) => l.id !== selectedLetterId);
  }, [letters, selectedLetterId, isAllCollapsedMode]);

  const baseAngles = [-13, -9.5, -6, -2.5, 1];
  const stepY = isAllCollapsedMode ? 56 * fanSpread : 48 * fanSpread;
  const stepX = isAllCollapsedMode ? 8 * fanSpread : 6 * fanSpread;

  return (
    <View style={[styles.stackContainer, isAllCollapsedMode && styles.stackContainerCentered]}>
      {stackCards.map((letter, index) => {
        const tiltAngle = baseAngles[index % baseAngles.length];
        const offsetY = index * stepY;
        const offsetX = index * stepX;

        return (
          <View
            key={letter.id}
            style={[
              styles.cardWrapper,
              {
                top: offsetY,
                left: offsetX,
                zIndex: index + 1,
              },
            ]}
          >
            <LetterSummaryCard
              letter={letter}
              index={index}
              isSelected={letter.id === selectedLetterId}
              onPress={() => onSelectLetter(letter.id)}
              stackTiltAngle={tiltAngle}
              width={cardWidth}
            />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  stackContainer: {
    position: 'relative',
    height: 380,
    width: 250,
  },
  stackContainerCentered: {
    alignSelf: 'center',
    width: 280,
  },
  cardWrapper: {
    position: 'absolute',
  },
});

export default LetterStack;
