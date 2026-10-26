import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, SafeAreaView, Linking, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/components/Header';
import SideMenu from '@/components/SideMenu';
import { SUPPORT_EMAIL } from '@/lib/earnings';

const darkBrown = "#423120";
const lightBrown = "#D7C3A7";
const white = "#FFFFFF";

const PRIVACY_POLICY_URL = "https://www.kosmiks.com/privacy";

type TabType = 'faq' | 'about' | 'contact' | 'terms' | 'privacy';

const sections: { id: TabType; name: string }[] = [
    { id: 'faq', name: 'FAQ' },
    { id: 'about', name: 'Tietoja meistä' },
    { id: 'contact', name: 'Ota yhteyttä' },
    { id: 'terms', name: 'Ehdot' },
    { id: 'privacy', name: 'Yksityisyys' },
];

const faqs = [
    {
        q: 'Miten voin varata palvelun?',
        a: 'Siirry Palvelut-sivulle, valitse kategoria ja palvelu, ja valitse sinulle sopiva ajankohta.',
    },
    {
        q: 'Voinko peruuttaa varaukseni?',
        a: 'Kyllä. Voit peruuttaa varauksesi profiilisi "Omat varaukset" -osiossa peruutusehtojen mukaisesti.',
    },
    {
        q: 'Mitä maksutapoja hyväksytään?',
        a: 'Hyväksymme yleisimmät maksukortit. Maksut käsitellään turvallisesti Stripen kautta.',
    },
];

export default function InfoPage() {
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
                        <Text style={styles.title}>Usein kysytyt kysymykset</Text>
                        {faqs.map((item, i) => (
                            <View key={item.q} style={[styles.block, i > 0 && styles.divider]}>
                                <Text style={styles.subTitle}>{item.q}</Text>
                                <Text style={styles.paragraph}>{item.a}</Text>
                            </View>
                        ))}
                    </>
                );
            case 'about':
                return (
                    <>
                        <Text style={styles.title}>Tietoja meistä</Text>
                        <Text style={styles.paragraph}>
                            KOSMIKS on kauneus- ja hyvinvointipalveluiden kohteesi. Yhdistämme sinut alan huippuammattilaisiin hiusten, kynsien, hieronnan ja muiden palveluiden parissa.
                        </Text>
                        <Text style={styles.paragraph}>
                            Missiomme on tehdä itsehoidosta helppoa kaikille. Tarvitsetpa sitten nopean siistimisen tai kokonaisen kylpyläpäivän, me hoidamme kaiken.
                        </Text>
                    </>
                );
            case 'contact':
                return (
                    <>
                        <Text style={styles.title}>Ota yhteyttä</Text>
                        <Text style={styles.paragraph}>
                            Onko sinulla kysyttävää tai palautetta? Kuulemme mielellämme sinusta!
                        </Text>
                        <View style={[styles.block, styles.divider]}>
                            <Text style={styles.label}>Sähköposti</Text>
                            <Text
                                style={[styles.paragraph, styles.link]}
                                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => { })}
                            >
                                {SUPPORT_EMAIL}
                            </Text>
                        </View>
                        <View style={[styles.block, styles.divider]}>
                            <Text style={styles.label}>Sijainti</Text>
                            <Text style={styles.paragraph}>Helsinki, Suomi</Text>
                        </View>
                    </>
                );
            case 'terms':
                return (
                    <>
                        <Text style={styles.title}>Käyttöehdot</Text>
                        <Text style={styles.paragraph}>
                            Tervetuloa Kosmiksiin. Käyttämällä sovellustamme hyväksyt nämä ehdot.
                        </Text>
                        <Text style={styles.subTitle}>1. Käyttäjätilit</Text>
                        <Text style={styles.paragraph}>
                            Olet vastuussa Google-tilisi luottamuksellisuuden säilyttämisestä.
                        </Text>
                        <Text style={styles.subTitle}>2. Varaukset</Text>
                        <Text style={styles.paragraph}>
                            Varaukset riippuvat saatavuudesta ja palveluntarjoajan vahvistuksesta.
                        </Text>
                        <Text style={styles.subTitle}>3. Peruutukset</Text>
                        <Text style={styles.paragraph}>
                            Peruutukset on tehtävä vähintään 24 tuntia etukäteen maksujen välttämiseksi.
                        </Text>
                    </>
                );
            case 'privacy':
                return (
                    <>
                        <Text style={styles.title}>Tietosuojaseloste</Text>
                        <Text style={styles.paragraph}>
                            Tietosuojasi on meille tärkeää. Tässä kerromme lyhyesti, miten keräämme ja käytämme tietojasi.
                        </Text>
                        <Text style={styles.subTitle}>Tiedonkeruu</Text>
                        <Text style={styles.paragraph}>
                            Keräämme tietoja, jotka annat meille suoraan, esimerkiksi luodessasi tilin tai varatessasi palvelun.
                        </Text>
                        <Text style={styles.subTitle}>Tietojen käyttö</Text>
                        <Text style={styles.paragraph}>
                            Käytämme tietojasi palvelujemme tarjoamiseen ja parantamiseen, maksujen käsittelyyn ja viestintään kanssasi.
                        </Text>
                        <Text
                            style={[styles.paragraph, styles.link]}
                            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => { })}
                        >
                            Lue koko tietosuojaseloste
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
                                    {section.name}
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
