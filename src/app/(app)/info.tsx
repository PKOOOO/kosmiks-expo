import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, SafeAreaView, Linking, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/components/Header';
import SideMenu from '@/components/SideMenu';
import { SUPPORT_EMAIL } from '@/lib/earnings';
import { useT, type TKey } from '@/i18n';

const darkBrown = "#423120";
const lightBrown = "#D7C3A7";
const white = "#FFFFFF";

const PRIVACY_POLICY_URL = "https://www.kosmiks.com/privacy";

type TabType = 'faq' | 'about' | 'contact' | 'terms' | 'privacy';

const sections: { id: TabType; name: TKey }[] = [
    { id: 'faq', name: 'info.faqTab' },
    { id: 'about', name: 'info.aboutTab' },
    { id: 'contact', name: 'info.contactTab' },
    { id: 'terms', name: 'info.termsTab' },
    { id: 'privacy', name: 'info.privacyTab' },
];

const faqs: { q: TKey; a: TKey }[] = [
    { q: 'info.q1', a: 'info.a1' },
    { q: 'info.q2', a: 'info.a2' },
    { q: 'info.q3', a: 'info.a3' },
];

export default function InfoPage() {
    const { t } = useT();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('faq');
    const [isMenuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        if (params.tab) {
            setActiveTab(params.tab as TabType);
        }
    }, [params.tab]);

    // Keep the selected pill in view when a deep link opens a later section.
    const pillsRef = useRef<ScrollViewInstance>(null);
    const pillX = useRef<Partial<Record<TabType, number>>>({});
    useEffect(() => {
        const x = pillX.current[activeTab];
        if (x !== undefined) pillsRef.current?.scrollTo({ x: Math.max(0, x - 20), animated: true });
    }, [activeTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'faq':
                return (
                    <>
                        <Text style={styles.title}>{t('info.faqTitle')}</Text>
                        {faqs.map((item, i) => (
                            <View key={item.q} style={[styles.block, i > 0 && styles.divider]}>
                                <Text style={styles.subTitle}>{t(item.q)}</Text>
                                <Text style={styles.paragraph}>{t(item.a)}</Text>
                            </View>
                        ))}
                    </>
                );
            case 'about':
                return (
                    <>
                        <Text style={styles.title}>{t('info.aboutTitle')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.about1')}
                        </Text>
                        <Text style={styles.paragraph}>
                            {t('info.about2')}
                        </Text>
                    </>
                );
            case 'contact':
                return (
                    <>
                        <Text style={styles.title}>{t('info.contactTitle')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.contactBody')}
                        </Text>
                        <View style={[styles.block, styles.divider]}>
                            <Text style={styles.label}>{t('info.email')}</Text>
                            <Text
                                style={[styles.paragraph, styles.link]}
                                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => { })}
                            >
                                {SUPPORT_EMAIL}
                            </Text>
                        </View>
                        <View style={[styles.block, styles.divider]}>
                            <Text style={styles.label}>{t('info.location')}</Text>
                            <Text style={styles.paragraph}>{t('info.locationValue')}</Text>
                        </View>
                    </>
                );
            case 'terms':
                return (
                    <>
                        <Text style={styles.title}>{t('info.termsTitle')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.termsIntro')}
                        </Text>
                        <Text style={styles.subTitle}>{t('info.terms1Title')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.terms1')}
                        </Text>
                        <Text style={styles.subTitle}>{t('info.terms2Title')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.terms2')}
                        </Text>
                        <Text style={styles.subTitle}>{t('info.terms3Title')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.terms3')}
                        </Text>
                    </>
                );
            case 'privacy':
                return (
                    <>
                        <Text style={styles.title}>{t('info.privacyTitle')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.privacyIntro')}
                        </Text>
                        <Text style={styles.subTitle}>{t('info.privacy1Title')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.privacy1')}
                        </Text>
                        <Text style={styles.subTitle}>{t('info.privacy2Title')}</Text>
                        <Text style={styles.paragraph}>
                            {t('info.privacy2')}
                        </Text>
                        <Text
                            style={[styles.paragraph, styles.link]}
                            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => { })}
                        >
                            {t('info.privacyFull')}
                        </Text>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
            <Header
                showBack={true}
                onBackPress={() => router.back()}
                showMenu={true}
                onMenuPress={() => setMenuVisible(true)}
                disableSafeAreaPadding={true}
            />

            {/* Side menu modal */}
            <Modal
                visible={isMenuVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setMenuVisible(false)}
                statusBarTranslucent={true}
            >
                <SideMenu onClose={() => setMenuVisible(false)} />
            </Modal>

            {/* Section pills: same filled beige as the category cards, one swipeable row */}
            <View>
                <ScrollView
                    ref={pillsRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pills}
                >
                    {sections.map((section) => {
                        const selected = section.id === activeTab;
                        return (
                            <TouchableOpacity
                                key={section.id}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                onPress={() => setActiveTab(section.id)}
                                onLayout={(e) => {
                                    pillX.current[section.id] = e.nativeEvent.layout.x;
                                }}
                                style={[styles.pill, selected && styles.pillSelected]}
                            >
                                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                                    {t(section.name)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {renderContent()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    pills: {
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 14,
        gap: 8,
    },
    pill: {
        height: 44,
        paddingHorizontal: 20,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: lightBrown,
    },
    pillSelected: {
        backgroundColor: darkBrown,
    },
    pillText: {
        fontSize: 16,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
    },
    pillTextSelected: {
        color: white,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 48,
    },
    title: {
        fontSize: 26,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        marginBottom: 16,
    },
    subTitle: {
        fontSize: 18,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        marginTop: 8,
        marginBottom: 6,
    },
    paragraph: {
        fontSize: 16,
        fontFamily: 'Philosopher-Regular',
        color: darkBrown,
        lineHeight: 24,
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        opacity: 0.6,
        marginBottom: 4,
    },
    link: {
        textDecorationLine: 'underline',
    },
    block: {
        paddingTop: 12,
    },
    divider: {
        borderTopWidth: 1,
        borderTopColor: lightBrown,
    },
});
