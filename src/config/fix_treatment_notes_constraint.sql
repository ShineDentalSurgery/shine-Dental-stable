-- Drop the old treatment_notes table with foreign key constraint
DROP TABLE IF EXISTS treatment_notes;

-- Create new treatment_notes table without foreign key constraint
CREATE TABLE treatment_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20) NOT NULL,
    patient_address VARCHAR(500),
    gender ENUM('Male', 'Female', 'Other'),
    age INT,
    treatment_date DATE NOT NULL,
    treatment_notes LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_id (patient_id),
    INDEX idx_treatment_date (treatment_date),
    UNIQUE KEY unique_patient_date (patient_id, treatment_date)
);
