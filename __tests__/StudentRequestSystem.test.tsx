import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StudentRequestButton } from '../lib/StudentRequestButton';
import { RequestModeModal } from '../lib/RequestModeModal';
import { RequestIndicator } from '../lib/RequestIndicator';
import { QuestionBubble } from '../lib/QuestionBubble';
import { StudentRequest } from '../lib/types/StudentRequest';

describe('Student Request System', () => {
  describe('StudentRequestButton', () => {
    it('should render for students', () => {
      const onRequestSubmit = vi.fn();
      render(
        <StudentRequestButton
          onRequestSubmit={onRequestSubmit}
          hasActiveRequest={false}
          isStudent={true}
        />,
      );

      const button = screen.getByRole('button', { name: /raise hand/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('✋');
    });

    it('should not render for teachers', () => {
      const onRequestSubmit = vi.fn();
      const { container } = render(
        <StudentRequestButton
          onRequestSubmit={onRequestSubmit}
          hasActiveRequest={false}
          isStudent={false}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show pending state when request is active', () => {
      const onRequestSubmit = vi.fn();
      render(
        <StudentRequestButton
          onRequestSubmit={onRequestSubmit}
          hasActiveRequest={true}
          isStudent={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('⏳');
      expect(button).toBeDisabled();
    });
  });

  describe('RequestModeModal', () => {
    it('should show voice and text options', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();

      render(<RequestModeModal onClose={onClose} onSubmit={onSubmit} />);

      expect(screen.getByText(/ask by voice/i)).toBeInTheDocument();
      expect(screen.getByText(/ask by text/i)).toBeInTheDocument();
    });

    it('should handle voice mode selection', async () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();

      render(<RequestModeModal onClose={onClose} onSubmit={onSubmit} />);

      const voiceButton = screen.getByText(/ask by voice/i).closest('button');
      fireEvent.click(voiceButton!);

      await waitFor(() => {
        expect(screen.getByText(/request to speak/i)).toBeInTheDocument();
      });

      const sendButton = screen.getByText(/send request/i);
      fireEvent.click(sendButton);

      expect(onSubmit).toHaveBeenCalledWith('voice');
    });

    it('should handle text mode with question input', async () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();

      render(<RequestModeModal onClose={onClose} onSubmit={onSubmit} />);

      const textButton = screen.getByText(/ask by text/i).closest('button');
      fireEvent.click(textButton!);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your question/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(textarea, { target: { value: 'What page are we on?' } });

      const submitButton = screen.getByText(/submit question/i);
      fireEvent.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith('text', 'What page are we on?');
    });
  });

  describe('RequestIndicator', () => {
    const mockRequest: StudentRequest = {
      id: 'req_1',
      studentIdentity: 'student1',
      studentName: 'John Doe',
      type: 'text',
      question: 'What page are we on?',
      timestamp: Date.now(),
      status: 'pending',
    };

    it('should render request indicator', () => {
      render(
        <RequestIndicator request={mockRequest} participantName="John Doe" isTeacher={false} />,
      );

      const indicator = screen.getByRole('button', { name: /has a question/i });
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('✋');
    });

    it('should show question bubble on click for text requests', () => {
      render(
        <RequestIndicator request={mockRequest} participantName="John Doe" isTeacher={false} />,
      );

      const indicator = screen.getByRole('button', { name: /has a question/i });
      fireEvent.click(indicator);

      expect(screen.getByText('What page are we on?')).toBeInTheDocument();
    });
  });

  describe('QuestionBubble', () => {
    it('should render question bubble', () => {
      render(<QuestionBubble question="What page are we on?" studentName="John Doe" />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('What page are we on?')).toBeInTheDocument();
    });

    it('should show displayed to all badge when applicable', () => {
      render(
        <QuestionBubble
          question="What page are we on?"
          studentName="John Doe"
          isDisplayedToAll={true}
        />,
      );

      expect(screen.getByText('Displayed to All')).toBeInTheDocument();
    });

    it('should handle close button', () => {
      const onClose = vi.fn();

      render(
        <QuestionBubble question="What page are we on?" studentName="John Doe" onClose={onClose} />,
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      // Wait for animation to complete
      setTimeout(() => {
        expect(onClose).toHaveBeenCalled();
      }, 250);
    });
  });
});
