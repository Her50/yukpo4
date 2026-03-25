import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { STUDIO_VOICE_LANG_OPTIONS, type StudioVoiceLangOption } from '../../constants/voiceoverLanguages';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

type Props = {
    visible: boolean;
    title: string;
    selectedValue: string;
    onSelect: (value: string) => void;
    onClose: () => void;
    searchPlaceholder: string;
};

export const StudioLangPickerModal: React.FC<Props> = ({
    visible,
    title,
    selectedValue,
    onSelect,
    onClose,
    searchPlaceholder,
}) => {
    const [q, setQ] = useState('');

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) {
            return STUDIO_VOICE_LANG_OPTIONS;
        }
        return STUDIO_VOICE_LANG_OPTIONS.filter(
            (o) =>
                o.label.toLowerCase().includes(s) ||
                o.value.toLowerCase().includes(s),
        );
    }, [q]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                            <SafeIcon name="x" size={22} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder={searchPlaceholder}
                        placeholderTextColor={modernColors.textSecondary}
                        style={styles.search}
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.value}
                        keyboardShouldPersistTaps="handled"
                        style={styles.list}
                        renderItem={({ item }) => {
                            const sel = item.value === selectedValue;
                            return (
                                <TouchableOpacity
                                    style={[styles.row, sel && styles.rowSelected]}
                                    onPress={() => {
                                        onSelect(item.value);
                                        onClose();
                                    }}
                                >
                                    <Text style={[styles.rowText, sel && styles.rowTextSelected]}>
                                        {item.label}
                                    </Text>
                                    {sel ? <SafeIcon name="check" size={18} color={modernColors.primary} /> : null}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={styles.empty}>—</Text>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '78%',
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    title: { fontSize: 17, fontWeight: '700', color: modernColors.text, flex: 1 },
    closeBtn: { padding: 4 },
    search: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 15,
        color: modernColors.text,
    },
    list: { paddingHorizontal: 8 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    rowSelected: { backgroundColor: '#EEF2FF' },
    rowText: { fontSize: 15, color: modernColors.text, flex: 1 },
    rowTextSelected: { fontWeight: '600', color: modernColors.primary },
    empty: { textAlign: 'center', padding: 24, color: modernColors.textSecondary },
});
