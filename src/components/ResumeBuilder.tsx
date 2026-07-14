import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { CandidateProfile } from '../types';

// We use default fonts available in react-pdf
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  contact: {
    fontSize: 10,
    color: '#4b5563',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  item: {
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  itemSubtitle: {
    fontStyle: 'italic',
    color: '#4b5563',
  },
  itemDate: {
    fontSize: 10,
    color: '#6b7280',
  },
  description: {
    marginTop: 4,
    color: '#374151',
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillPill: {
    backgroundColor: '#f3f4f6',
    padding: '2 6',
    borderRadius: 4,
    fontSize: 9,
  }
});

interface ResumeDocumentProps {
  profile: CandidateProfile;
  injectedKeywords?: string[];
}

export const ResumeDocument: React.FC<ResumeDocumentProps> = ({ profile, injectedKeywords = [] }) => {
  // Combine user skills with the missing keywords we want to inject
  const allSkills = [...(profile.skills || []), ...injectedKeywords];
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{profile.personalInfo?.fullName || profile.name}</Text>
          <Text style={styles.contact}>
            {profile.personalInfo?.email} | {profile.personalInfo?.phone} | {profile.personalInfo?.location}
          </Text>
          {profile.personalInfo?.linkedin && (
            <Text style={styles.contact}>{profile.personalInfo.linkedin}</Text>
          )}
        </View>

        {/* Summary */}
        {profile.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.description}>{profile.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {profile.experience && profile.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {profile.experience.map((exp, i) => (
              <View key={i} style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{exp.title} at {exp.company}</Text>
                  <Text style={styles.itemDate}>{exp.startDate} – {exp.endDate || 'Present'}</Text>
                </View>
                <Text style={styles.description}>{exp.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {profile.education && profile.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {profile.education.map((edu, i) => (
              <View key={i} style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{edu.institution}</Text>
                  <Text style={styles.itemDate}>{edu.year}</Text>
                </View>
                <Text style={styles.itemSubtitle}>{edu.degree}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {allSkills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skills}>
              {allSkills.map((skill, i) => (
                <Text key={i} style={styles.skillPill}>{skill}</Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};
