-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 28, 2023 at 10:02 AM
-- Server version: 10.4.22-MariaDB
-- PHP Version: 7.4.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `presensi`
--

-- --------------------------------------------------------

--
-- Table structure for table `base_coordinates`
--

CREATE TABLE `base_coordinates` (
  `id` int(11) NOT NULL,
  `coordinates` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `base_coordinates`
--

INSERT INTO `base_coordinates` (`id`, `coordinates`) VALUES
(1, '0.0,0.0');

-- --------------------------------------------------------

--
-- Table structure for table `presence`
--

CREATE TABLE `presence` (
  `presence_id` int(11) NOT NULL,
  `user_id` text NOT NULL,
  `presence_coords` text NOT NULL,
  `presence_status` int(11) NOT NULL DEFAULT 0,
  `time_in` text NOT NULL,
  `time_out` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `presence`
--

INSERT INTO `presence` (`presence_id`, `user_id`, `presence_coords`, `presence_status`, `time_in`, `time_out`) VALUES
(1, '1111', '0.0, 0.0', 1, '2023-04-27 01:26:11', '2023-04-28 01:32:13'),
(2, '1111', '0.1,0.2', 1, '2023-04-27 01:30:11', '2023-04-28 01:57:15'),
(3, '2222', '0.0, 0.0', 0, '', ''),
(47, '4444', '-8.354010581970215,114.16146850585938', 1, '2023-04-28 14:33:03', '2023-04-28 14:34:40');

-- --------------------------------------------------------

--
-- Table structure for table `setting`
--

CREATE TABLE `setting` (
  `id` int(11) NOT NULL,
  `instance_name` text NOT NULL,
  `radius_range` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setting`
--

INSERT INTO `setting` (`id`, `instance_name`, `radius_range`) VALUES
(1, 'Test', 100);

-- --------------------------------------------------------

--
-- Table structure for table `shift_type`
--

CREATE TABLE `shift_type` (
  `shift_id` int(11) NOT NULL,
  `shift_name` text NOT NULL,
  `time_in` text,
  `time_out` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `shift_type`
--

INSERT INTO `shift_type` (`shift_id`, `shift_name`, `time_in`, `time_out`) VALUES
(1, 'Pegawai', '09:00-10:30', '16:00-16:30'),
(2, 'Siswa', '09:00-10:30', '16:00-16:30'),
(3, 'Siswa Kelas 2', '07:00-07:30', '00:00-23:59'),
(4, 'Pegawai Kelas 3', '07:00-07:30', '16:00-16:30'),
(5, 'Tester', '00:00-23:59', '00:00-23:59');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` text NOT NULL,
  `user_name` text NOT NULL,
  `phone_number` text NOT NULL,
  `shift_id` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `user_name`, `phone_number`, `shift_id`) VALUES
('1111', 'Contoh Pegawai', '', 2),
('2222', 'Contoh Siswa', '', 1),
('3333', 'Siswa Kelas 2', '6285800412470', 5),
('4444', 'Admin Test', '6282240449894', 5);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `base_coordinates`
--
ALTER TABLE `base_coordinates`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `presence`
--
ALTER TABLE `presence`
  ADD PRIMARY KEY (`presence_id`);

--
-- Indexes for table `setting`
--
ALTER TABLE `setting`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shift_type`
--
ALTER TABLE `shift_type`
  ADD PRIMARY KEY (`shift_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`(100));

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `base_coordinates`
--
ALTER TABLE `base_coordinates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `presence`
--
ALTER TABLE `presence`
  MODIFY `presence_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `setting`
--
ALTER TABLE `setting`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `shift_type`
--
ALTER TABLE `shift_type`
  MODIFY `shift_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
